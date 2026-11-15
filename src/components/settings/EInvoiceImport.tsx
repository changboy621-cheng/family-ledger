import { useMemo, useRef, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import type { LedgerType } from '../../types';
import { supabase } from '../../lib/supabase';
import { parseCSV } from '../../lib/csv';
import { formatAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { paymentMethodForKind } from '../../lib/accounts';
import { decodeInvoiceFile, guessCategoryId, invoiceNote, parseEInvoiceText, type EInvoice } from '../../lib/einvoice';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';

interface Preview {
  fileName: string;
  invoices: EInvoice[];
  voided: number;
  invalid: number;
  /** 每張發票猜到的分類 id */
  guessed: Map<string, string>;
}

const chip = (on: boolean) =>
  `rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`;
const selectClass = 'h-10 min-w-0 rounded-lg border border-slate-300 bg-card px-2 text-sm text-slate-900';

/**
 * 匯入財政部「載具消費明細」：每張發票變成一筆支出，依店家猜分類（可整組改），
 * 以發票號碼去重複，已匯入過的自動略過。
 */
export function EInvoiceImport() {
  const profile = useAuthStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const bumpDataVersion = useUIStore((state) => state.bumpDataVersion);
  const { categories } = useCategories('expense');
  const { activeAccounts, status: accountStatus } = useAccounts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ledger, setLedger] = useState<LedgerType>('family');
  const [accountId, setAccountId] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const twdAccounts = activeAccounts.filter((account) => account.currency === 'TWD');

  // 依猜到的分類分組，讓使用者整組改分類。
  const groups = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, { categoryId: string; count: number; total: number; sellers: Set<string> }>();
    for (const invoice of preview.invoices) {
      const guessedId = preview.guessed.get(invoice.number) ?? '';
      const group = map.get(guessedId) ?? { categoryId: guessedId, count: 0, total: 0, sellers: new Set<string>() };
      group.count += 1;
      group.total += invoice.total;
      if (invoice.seller) group.sellers.add(invoice.seller);
      map.set(guessedId, group);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [preview]);

  async function handleFile(file: File) {
    try {
      const text = decodeInvoiceFile(await file.arrayBuffer());
      const result = parseEInvoiceText(text, parseCSV);
      if (result.invoices.length === 0) {
        showToast('檔案裡找不到可匯入的發票，請確認是「載具消費明細」下載檔。', 'error');
        return;
      }
      const guessed = new Map<string, string>();
      for (const invoice of result.invoices) guessed.set(invoice.number, guessCategoryId(invoice, categories) ?? '');
      setOverrides({});
      setPreview({ fileName: file.name, ...result, guessed });
    } catch (error) {
      showToast(getErrorMessage(error, '讀取檔案失敗'), 'error');
    }
  }

  async function handleImport() {
    if (!preview || !profile?.family_id || busy) return;
    const account = twdAccounts.find((item) => item.id === accountId);
    const rows = preview.invoices.map((invoice) => {
      const guessedId = preview.guessed.get(invoice.number) ?? '';
      return {
        family_id: profile.family_id,
        owner_id: profile.id,
        recorded_by: profile.id,
        ledger_type: ledger,
        type: 'expense',
        amount: Math.round(invoice.total),
        currency: 'TWD',
        category_id: overrides[guessedId] || guessedId,
        note: invoiceNote(invoice) || null,
        payment_method: account ? paymentMethodForKind(account.kind) : null,
        transaction_date: invoice.date,
        invoice_number: invoice.number,
        ...(account ? { account_id: account.id } : {})
      };
    });
    if (rows.some((row) => !row.category_id)) {
      showToast('還沒有支出分類，請先建立分類。', 'error');
      return;
    }
    setBusy(true);
    try {
      let inserted = 0;
      for (let index = 0; index < rows.length; index += 200) {
        const { data, error } = await supabase
          .from('transactions')
          .upsert(rows.slice(index, index + 200), { onConflict: 'family_id,invoice_number', ignoreDuplicates: true })
          .select('id');
        if (error) throw error;
        inserted += data?.length ?? 0;
      }
      const skipped = rows.length - inserted;
      showToast(`已匯入 ${inserted} 筆${skipped > 0 ? `，${skipped} 筆先前匯入過已略過` : ''}`);
      setPreview(null);
      bumpDataVersion();
    } catch (error) {
      const message = getErrorMessage(error, '匯入失敗，請稍後再試。');
      showToast(
        /invoice_number|on conflict|unique or exclusion/i.test(message) ? '請先在 Supabase 執行 015_accounts.sql 再匯入發票。' : message,
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  const total = preview?.invoices.reduce((sum, invoice) => sum + invoice.total, 0) ?? 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700" aria-hidden="true">
          <ReceiptText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">匯入發票載具</h2>
          <p className="mt-1 text-sm text-slate-500">
            到財政部「電子發票整合服務平台」→ 載具消費紀錄，下載消費明細檔，再選擇檔案匯入。每張發票記成一筆支出，匯過的會自動略過。
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />

      {!preview ? (
        <button
          type="button"
          className="mt-4 h-11 w-full rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => fileRef.current?.click()}
        >
          選擇載具明細檔
        </button>
      ) : (
        <div className="mt-4 grid gap-4">
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            「{preview.fileName}」：{preview.invoices.length} 張發票，共 {formatAmount(total, 'TWD')}
            {preview.voided > 0 ? `；${preview.voided} 張作廢不匯入` : ''}
            {preview.invalid > 0 ? `；${preview.invalid} 列格式看不懂已略過` : ''}。
          </p>

          <div className="flex flex-wrap gap-2">
            {(['family', 'personal'] as LedgerType[]).map((option) => (
              <button key={option} type="button" className={chip(ledger === option)} onClick={() => setLedger(option)}>
                記到{option === 'family' ? '家庭帳本' : '個人帳本'}
              </button>
            ))}
          </div>

          {accountStatus === 'ready' && twdAccounts.length > 0 ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              付款帳戶
              <select className={selectClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="">不指定</option>
                {twdAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">分類（依店家自動判斷，可整組改）</span>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {groups.map((group) => (
                <li key={group.categoryId} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold text-slate-900">
                      {group.count} 張 · {formatAmount(group.total, 'TWD')}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{[...group.sellers].slice(0, 3).join('、')}</span>
                  </span>
                  <select
                    className={selectClass}
                    value={overrides[group.categoryId] || group.categoryId}
                    onChange={(event) => setOverrides((current) => ({ ...current, [group.categoryId]: event.target.value }))}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="h-11 rounded-lg border border-slate-300 font-semibold text-slate-700" onClick={() => setPreview(null)} disabled={busy}>
              取消
            </button>
            <button type="button" className="h-11 rounded-lg bg-action font-semibold text-white disabled:opacity-60" onClick={() => void handleImport()} disabled={busy}>
              {busy ? '匯入中...' : `匯入 ${preview.invoices.length} 筆`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
