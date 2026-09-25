import { useEffect, useState } from 'react';
import type { Currency, LedgerType } from '../../types';
import { currentYearMonth } from '../../lib/utils';
import { formatAmount } from '../../lib/currency';
import { budgetsForLedger, findBudgetAmount, parseBudgetInput } from '../../lib/budget';
import { useAuth } from '../../hooks/useAuth';
import { useBudgets, type BudgetInput } from '../../hooks/useBudgets';
import { useCategories } from '../../hooks/useCategories';
import { useUIStore } from '../../store/uiStore';

const LEDGER_OPTIONS: Array<{ value: LedgerType; label: string }> = [
  { value: 'family', label: '家庭' },
  { value: 'personal', label: '個人' }
];

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: 'TWD', label: 'NT$' },
  { value: 'USD', label: 'US$' }
];

// 設定頁「每月預算」：家庭／個人 × TWD／USD，各有一個總預算與各支出類別預算。
// 自本月起生效、之後每月沿用；清空後儲存＝自本月起取消。
export function BudgetManager() {
  const { profile } = useAuth();
  const { categories } = useCategories('expense');
  const { budgets, loading, error, reload, saveBudget } = useBudgets(currentYearMonth());
  const [ledgerType, setLedgerType] = useState<LedgerType>('family');
  const [currency, setCurrency] = useState<Currency>(profile?.default_currency ?? 'TWD');

  const ledgerBudgets = budgetsForLedger(budgets, ledgerType, profile?.id ?? '');
  const amountOf = (categoryId: string | null) => findBudgetAmount(ledgerBudgets, ledgerType, categoryId, currency);
  const categoryTotal = categories.reduce((sum, category) => sum + (amountOf(category.id) ?? 0), 0);
  const total = amountOf(null);

  function save(categoryId: string | null, amount: number) {
    const input: BudgetInput = { ledgerType, categoryId, currency, amount };
    return saveBudget(input);
  }

  return (
    <section id="budget" className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-900">每月預算</h2>
      <p className="mt-1 text-sm text-slate-500">自本月起生效，之後每個月自動沿用。清空後儲存即取消。</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Segmented options={LEDGER_OPTIONS} value={ledgerType} onChange={setLedgerType} label="帳本" />
        <Segmented options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} label="幣別" />
      </div>

      {error ? (
        <button type="button" className="mt-4 text-sm font-semibold text-red-600" onClick={() => void reload()}>
          預算載入失敗，點此重試
        </button>
      ) : loading ? (
        <p className="mt-4 text-sm text-slate-400">載入中…</p>
      ) : (
        <div className="mt-4 grid gap-2">
          <BudgetField
            key={`${ledgerType}-${currency}-total`}
            label="每月總預算"
            emphasized
            currency={currency}
            amount={total}
            onSave={(amount) => save(null, amount)}
          />
          {categoryTotal > 0 ? (
            <p className={`px-1 text-xs ${total !== null && categoryTotal > total ? 'text-amber-600' : 'text-slate-400'}`}>
              類別預算合計 {formatAmount(categoryTotal, currency)}
              {total !== null && categoryTotal > total ? '，已超過總預算' : ''}
            </p>
          ) : null}

          <h3 className="mt-2 text-sm font-semibold text-slate-700">類別預算（選填）</h3>
          {categories.map((category) => (
            <BudgetField
              key={`${ledgerType}-${currency}-${category.id}`}
              label={`${category.icon} ${category.name}`}
              currency={currency}
              amount={amountOf(category.id)}
              onSave={(amount) => save(category.id, amount)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-8 rounded-md px-3 text-sm font-semibold ${
            value === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BudgetField({
  label,
  currency,
  amount,
  onSave,
  emphasized = false
}: {
  label: string;
  currency: Currency;
  amount: number | null;
  onSave: (amount: number) => Promise<void>;
  emphasized?: boolean;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const saved = amount === null ? '' : String(amount);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);

  // 伺服器值變動（初次載入、儲存後重讀）時同步輸入框。
  useEffect(() => setDraft(saved), [saved]);

  const dirty = draft.trim() !== saved;

  async function save() {
    const value = parseBudgetInput(draft, currency);
    if (value === null) {
      showToast('請輸入正確的金額。', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave(value);
      showToast(value === 0 ? '已取消預算' : '預算已更新');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '儲存失敗，請稍後再試。', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${emphasized ? 'bg-familySoft' : 'bg-slate-50'}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) void save();
      }}
    >
      <span className={`min-w-0 flex-1 truncate text-sm ${emphasized ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
        {label}
      </span>
      <input
        className="h-9 w-28 rounded-lg border border-slate-300 bg-white px-3 text-right text-sm outline-none focus:border-family focus:ring-2 focus:ring-family/30"
        inputMode={currency === 'TWD' ? 'numeric' : 'decimal'}
        placeholder="未設定"
        aria-label={`${label}預算`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        type="submit"
        disabled={!dirty || saving}
        className="h-9 shrink-0 rounded-lg bg-family px-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {saving ? '儲存中' : '儲存'}
      </button>
    </form>
  );
}
