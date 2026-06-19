import { useEffect, useState } from 'react';
import type { Currency, LedgerType, Transaction, TransactionType } from '../../types';
import { normalizeAmount } from '../../lib/currency';
import { todayISO } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import type { TransactionInput } from '../../hooks/useTransactions';
import { AmountInput } from '../common/AmountInput';
import { CategoryPicker } from '../common/CategoryPicker';
import { CurrencySelector } from '../common/CurrencySelector';

interface TransactionFormProps {
  initialLedgerType: LedgerType;
  onSubmit: (input: TransactionInput) => Promise<void>;
  onClose: () => void;
  initialTransaction?: Transaction | null;
}

export function TransactionForm({ initialLedgerType, onSubmit, onClose, initialTransaction }: TransactionFormProps) {
  const profile = useAuthStore((state) => state.profile);
  const [ledgerType, setLedgerType] = useState<LedgerType>(initialTransaction?.ledger_type ?? initialLedgerType);
  const [type, setType] = useState<TransactionType>(initialTransaction?.type ?? 'expense');
  const [currency, setCurrency] = useState<Currency>(initialTransaction?.currency ?? profile?.default_currency ?? 'TWD');
  const [amount, setAmount] = useState(initialTransaction ? String(initialTransaction.amount) : '');
  const [categoryId, setCategoryId] = useState(initialTransaction?.category_id ?? '');
  const [transactionDate, setTransactionDate] = useState(initialTransaction?.transaction_date ?? todayISO());
  const [note, setNote] = useState(initialTransaction?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { categories } = useCategories(type);

  useEffect(() => {
    setLedgerType(initialTransaction?.ledger_type ?? initialLedgerType);
    setType(initialTransaction?.type ?? 'expense');
    setCurrency(initialTransaction?.currency ?? profile?.default_currency ?? 'TWD');
    setAmount(initialTransaction ? String(initialTransaction.amount) : '');
    setCategoryId(initialTransaction?.category_id ?? '');
    setTransactionDate(initialTransaction?.transaction_date ?? todayISO());
    setNote(initialTransaction?.note ?? '');
    setError('');
  }, [initialLedgerType, initialTransaction, profile?.default_currency]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((category) => category.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const normalizedAmount = normalizeAmount(amount, currency);

    if (!normalizedAmount) {
      setError('請輸入大於 0 的金額。');
      return;
    }

    if (!categoryId) {
      setError('請選擇類別。');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        ledger_type: ledgerType,
        type,
        amount: normalizedAmount,
        currency,
        category_id: categoryId,
        transaction_date: transactionDate,
        note
      });
      setAmount('');
      setNote('');
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '儲存失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/40 p-4">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">{initialTransaction ? '編輯交易' : '新增記帳'}</h2>
          <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>
            關閉
          </button>
        </div>

        <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            {(['family', 'personal'] as LedgerType[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  ledgerType === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
                onClick={() => setLedgerType(option)}
              >
                {option === 'family' ? '家庭帳本' : '個人帳本'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(['expense', 'income'] as TransactionType[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  type === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                onClick={() => setType(option)}
              >
                {option === 'expense' ? '支出' : '收入'}
              </button>
            ))}
          </div>

          <CurrencySelector value={currency} onChange={setCurrency} />
          <AmountInput currency={currency} value={amount} onChange={setAmount} />
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            日期
            <input
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            備註
            <textarea
              className="min-h-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="晚餐、機票、生活用品..."
            />
          </label>

          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

          <button
            className="h-12 rounded-lg bg-family px-4 font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            {saving ? '儲存中...' : initialTransaction ? '更新交易' : '儲存交易'}
          </button>
        </form>
      </div>
    </div>
  );
}
