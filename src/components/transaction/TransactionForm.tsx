import { useEffect, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, Transaction, TransactionType } from '../../types';
import { normalizeAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { paymentMethodLabel } from '../../lib/constants';
import { todayISO } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import { useEntrySuggestions } from '../../hooks/useEntrySuggestions';
import { filterNotes } from '../../lib/suggestions';
import type { TransactionInput } from '../../hooks/useTransactions';
import { AmountInput } from '../common/AmountInput';
import { CategoryPicker } from '../common/CategoryPicker';
import { CurrencySelector } from '../common/CurrencySelector';
import { Modal } from '../common/Modal';

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialTransaction?.payment_method ?? 'cash');
  const [note, setNote] = useState(initialTransaction?.note ?? '');
  const [ownerId, setOwnerId] = useState(initialTransaction?.owner_id ?? profile?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { categories, createCategory, updateCategory } = useCategories(type);
  const { members } = useFamilyMembers();
  const { frequentItems, noteHistory } = useEntrySuggestions(ledgerType, type);
  const noteSuggestions = filterNotes(noteHistory, note);

  function applyQuickItem(categoryId: string, quickNote: string) {
    setCategoryId(categoryId);
    if (quickNote) setNote(quickNote);
  }

  useEffect(() => {
    setLedgerType(initialTransaction?.ledger_type ?? initialLedgerType);
    setType(initialTransaction?.type ?? 'expense');
    setCurrency(initialTransaction?.currency ?? profile?.default_currency ?? 'TWD');
    setAmount(initialTransaction ? String(initialTransaction.amount) : '');
    setCategoryId(initialTransaction?.category_id ?? '');
    setTransactionDate(initialTransaction?.transaction_date ?? todayISO());
    setPaymentMethod(initialTransaction?.payment_method ?? 'cash');
    setNote(initialTransaction?.note ?? '');
    setOwnerId(initialTransaction?.owner_id ?? profile?.id ?? '');
    setError('');
  }, [initialLedgerType, initialTransaction, profile?.default_currency, profile?.id]);

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
        payment_method: paymentMethod,
        note,
        owner_id: ledgerType === 'family' ? ownerId || profile?.id : undefined
      });
      setAmount('');
      setNote('');
      onClose();
    } catch (submitError) {
      setError(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? '目前離線，請連上網路後再試。'
          : getErrorMessage(submitError, '儲存失敗，請稍後再試。')
      );
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle = initialTransaction ? '編輯交易' : '新增記帳';

  return (
    <Modal title={dialogTitle} onClose={onClose}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{dialogTitle}</h2>
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

          <div className="flex gap-2">
            {(['cash', 'card'] as PaymentMethod[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  paymentMethod === option ? 'bg-family text-white' : 'bg-slate-100 text-slate-600'
                }`}
                onClick={() => setPaymentMethod(option)}
              >
                {paymentMethodLabel(option)}
              </button>
            ))}
          </div>

          {frequentItems.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-sm font-medium text-slate-700">常用快捷</p>
              <div className="flex flex-wrap gap-2">
                {frequentItems.map((item) => {
                  // 已套用（分類與備註都吻合目前表單）時高亮，讓使用者看得出點了哪一個。
                  const active = item.categoryId === categoryId && item.note === note;
                  return (
                  <button
                    key={`${item.categoryId}-${item.note}`}
                    type="button"
                    aria-pressed={active}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
                      active
                        ? 'border-family bg-familySoft text-family'
                        : 'border-slate-200 bg-white text-slate-700 active:bg-slate-50'
                    }`}
                    onClick={() => applyQuickItem(item.categoryId, item.note)}
                  >
                    <span aria-hidden="true">{item.categoryIcon}</span>
                    <span>
                      {item.categoryName}
                      {item.note ? ` · ${item.note}` : ''}
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {ledgerType === 'family' && members.length > 1 ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">這筆是誰花的</span>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      ownerId === member.id
                        ? 'border-family bg-familySoft text-family'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                    onClick={() => setOwnerId(member.id)}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.avatar_color }} />
                    {member.display_name}
                    {member.id === profile?.id ? '（我）' : ''}
                  </button>
                ))}
              </div>
              {ownerId && ownerId !== profile?.id ? (
                <p className="text-xs text-slate-500">這筆會記在對方名下，並標註由你（{profile?.display_name}）代記。</p>
              ) : null}
            </div>
          ) : null}

          <CurrencySelector value={currency} onChange={setCurrency} />
          <AmountInput currency={currency} value={amount} onChange={setAmount} />
          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            onCreate={createCategory}
            onUpdate={updateCategory}
          />

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            日期
            <input
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            備註
            <textarea
              className="min-h-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="晚餐、機票、生活用品..."
            />
            {noteSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {noteSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 active:bg-slate-50"
                    onClick={() => setNote(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
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
    </Modal>
  );
}
