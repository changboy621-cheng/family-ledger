import { useEffect, useRef, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, Transaction, TransactionType } from '../../types';
import { normalizeAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { paymentMethodLabel } from '../../lib/constants';
import { todayISO } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import { useEntrySuggestions } from '../../hooks/useEntrySuggestions';
import { mergeNoteSuggestions, pinnedNotesKey, togglePin } from '../../lib/suggestions';
import { loadStringList, saveStringList } from '../../lib/search';
import { useUIStore } from '../../store/uiStore';
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
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories(type);
  const { members } = useFamilyMembers();
  const { noteHistory, noteDefaults } = useEntrySuggestions(ledgerType, type);
  const showToast = useUIStore((state) => state.showToast);
  const [pinnedNotes, setPinnedNotes] = useState<string[]>([]);

  // 釘選清單依帳本／收支型別分開存；切換時重讀。
  useEffect(() => {
    setPinnedNotes(loadStringList(localStorage, pinnedNotesKey(ledgerType, type)));
  }, [ledgerType, type]);

  const noteSuggestions = mergeNoteSuggestions(pinnedNotes, noteHistory, note);

  /** 點圓籤：帶入備註＋該備註上次的分類與付款方式；金額只在尚未輸入時帶入（不覆蓋）。 */
  function applySuggestion(suggestion: string) {
    setNote(suggestion);
    const defaults = noteDefaults.get(suggestion);
    if (!defaults) return;
    if (defaults.category_id && categories.some((category) => category.id === defaults.category_id)) {
      setCategoryId(defaults.category_id);
    }
    if (defaults.payment_method) setPaymentMethod(defaults.payment_method);
    if (!amount.trim() && defaults.amount != null) {
      if (defaults.currency) setCurrency(defaults.currency);
      setAmount(String(defaults.amount));
    }
  }

  function togglePinned(suggestion: string) {
    const next = togglePin(pinnedNotes, suggestion);
    setPinnedNotes(next);
    saveStringList(localStorage, pinnedNotesKey(ledgerType, type), next);
    showToast(next.includes(suggestion) ? '已釘選常用備註' : '已取消釘選');
  }

  // 觸控長按釘選：500ms 觸發；觸發後抑制「同一顆」圓籤下一次點擊的帶入。
  // firedFor 記錄觸發長按的備註字串（而非單一布林值），避免某顆圓籤的長按
  // 因 iOS 原生選字選單吃掉合成 click 而殘留 true，誤把「另一顆」圓籤的下一次點擊也吃掉。
  const longPressRef = useRef<{ timer: number; firedFor: string | null }>({ timer: 0, firedFor: null });
  function startLongPress(suggestion: string, pointerType: string) {
    window.clearTimeout(longPressRef.current.timer); // 多點觸控時先清掉前一顆圓籤未觸發的計時器，避免孤兒 timer 誤觸
    if (pointerType !== 'touch') return; // 桌面用右鍵（contextmenu）
    longPressRef.current.firedFor = null;
    longPressRef.current.timer = window.setTimeout(() => {
      longPressRef.current.firedFor = suggestion;
      togglePinned(suggestion);
    }, 500);
  }
  function cancelLongPress() {
    window.clearTimeout(longPressRef.current.timer);
  }
  function handleSuggestionClick(suggestion: string) {
    if (longPressRef.current.firedFor === suggestion) {
      longPressRef.current.firedFor = null;
      return;
    }
    longPressRef.current.firedFor = null;
    applySuggestion(suggestion);
  }

  // 元件卸載時清掉未觸發的長按計時器，避免對已關閉的表單觸發釘選。
  useEffect(() => () => window.clearTimeout(longPressRef.current.timer), []);

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
            onDelete={deleteCategory}
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
                {noteSuggestions.map((suggestion) => {
                  const pinned = pinnedNotes.includes(suggestion);
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      className={`max-w-[14rem] truncate select-none rounded-full border px-3 py-1 text-xs active:bg-slate-50 ${
                        pinned ? 'border-family bg-familySoft text-family' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                      style={{ WebkitTouchCallout: 'none' }}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        togglePinned(suggestion);
                      }}
                      onPointerDown={(event) => startLongPress(suggestion, event.pointerType)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      title="點一下帶入；長按（或右鍵）釘選"
                    >
                      {pinned ? '📌 ' : ''}
                      {suggestion}
                    </button>
                  );
                })}
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
