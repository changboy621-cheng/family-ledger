import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { LedgerType } from '../../types';
import { supabase } from '../../lib/supabase';
import { parseTransactions } from '../../lib/schemas';
import { useAuthStore } from '../../store/authStore';
import { useReferenceStore } from '../../store/referenceStore';
import { useUIStore } from '../../store/uiStore';
import { todayISO } from '../../lib/utils';
import { parseCSV, toCSV } from '../../lib/csv';
import {
  EXPORT_HEADER,
  buildExportRows,
  categoryKey,
  collectMissingCategories,
  parseImportRecords,
  type ImportRecord
} from '../../lib/transactionPorting';
import { detectAndroMoney, parseAndroMoney } from '../../lib/importAdapters';

function downloadCSV(filename: string, content: string) {
  const bom = String.fromCharCode(0xfeff);
  const blob = new Blob([`${bom}${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataTools() {
  const profile = useAuthStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<LedgerType>('family');
  const [preview, setPreview] = useState<{ records: ImportRecord[]; skipped: number; fileName: string; format: string } | null>(null);

  async function handleExport() {
    if (!profile?.family_id || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(*), owner:user_profiles(*)')
        .eq('family_id', profile.family_id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      const transactions = parseTransactions(data);
      if (transactions.length === 0) {
        showToast('目前沒有可匯出的交易。', 'error');
        return;
      }

      downloadCSV(`family-ledger-${todayISO()}.csv`, toCSV([EXPORT_HEADER, ...buildExportRows(transactions)]));
      showToast(`已匯出 ${transactions.length} 筆`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '匯出失敗，請稍後再試。', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const isAndroMoney = detectAndroMoney(rows);
      const { records, skipped } = isAndroMoney ? parseAndroMoney(rows) : parseImportRecords(rows);
      const format = isAndroMoney ? 'AndroMoney（理財幫手）' : '一般 CSV';
      if (records.length === 0) {
        showToast(skipped > 0 ? `這個檔案的 ${skipped} 筆都無法辨識。` : '找不到可匯入的資料。', 'error');
        setPreview(null);
      } else {
        setPreview({ records, skipped, fileName: file.name, format });
      }
    } catch {
      showToast('讀取檔案失敗，請確認是 CSV 檔。', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function confirmImport() {
    if (!profile?.family_id || !preview || busy) return;
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id, name, type')
        .or(`family_id.is.null,family_id.eq.${profile.family_id}`);

      const categoryByKey = new Map<string, string>();
      (existing ?? []).forEach((category) => categoryByKey.set(categoryKey(category.type, category.name), category.id));

      // 對不到的類別一次性 batch 建立（去重），取代原本逐筆 await 的 N+1 往返。
      const missing = collectMissingCategories(preview.records, new Set(categoryByKey.keys()));
      if (missing.length > 0) {
        const { data: created, error } = await supabase
          .from('categories')
          .insert(
            missing.map((category) => ({
              name: category.name,
              icon: '🏷️',
              type: category.type,
              family_id: profile.family_id,
              is_shared: true,
              sort_order: 999
            }))
          )
          .select('id, name, type');
        if (error || !created) throw error ?? new Error('建立類別失敗');
        created.forEach((category) => categoryByKey.set(categoryKey(category.type, category.name), category.id));
      }

      const inserts = preview.records.map((record) => ({
        family_id: profile.family_id,
        owner_id: profile.id,
        recorded_by: profile.id,
        ledger_type: ledger,
        type: record.type,
        amount: record.amount,
        currency: record.currency,
        category_id: categoryByKey.get(categoryKey(record.type, record.categoryName)),
        transaction_date: record.transaction_date,
        payment_method: record.paymentMethod,
        note: record.note || null
      }));

      const { error: insertError } = await supabase.from('transactions').insert(inserts);
      if (insertError) throw insertError;

      // 匯入可能新建分類，使分類快取失效，否則表單/QuickAdd 仍看不到新分類。
      await useReferenceStore.getState().reloadCategories(profile.family_id);

      showToast(`已匯入 ${inserts.length} 筆${preview.skipped > 0 ? `（略過 ${preview.skipped}）` : ''}`);
      setPreview(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '匯入失敗，請稍後再試。', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-900">資料匯入／匯出</h2>
      <p className="mt-1 text-sm text-slate-500">把交易備份成 CSV，或從別的記帳 App 匯入。</p>

      <div className="mt-4 grid gap-3">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 font-semibold text-slate-700 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          匯出 CSV（備份）
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 font-semibold text-slate-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          選擇 CSV 檔匯入
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleFile(event)} />
      </div>

      {preview ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-xs text-slate-500">偵測格式：{preview.format}</p>
          <p className="mt-1 text-sm text-slate-700">
            檔案「{preview.fileName}」：將匯入 <strong className="text-family">{preview.records.length}</strong> 筆
            {preview.skipped > 0 ? `，略過 ${preview.skipped} 筆（期初/轉帳/資料不全）` : ''}。
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-slate-600">匯入到</span>
            {(['family', 'personal'] as LedgerType[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  ledger === option ? 'bg-family text-white' : 'bg-white text-slate-600 border border-slate-300'
                }`}
                onClick={() => setLedger(option)}
              >
                {option === 'family' ? '家庭帳本' : '個人帳本'}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={busy}
              className="h-10 flex-1 rounded-lg bg-family font-semibold text-white disabled:opacity-60"
            >
              {busy ? '匯入中...' : '確認匯入'}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy}
              className="h-10 flex-1 rounded-lg border border-slate-300 font-semibold text-slate-600"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
