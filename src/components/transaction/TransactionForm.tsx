import { useEffect, useRef, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, Transaction, TransactionType } from '../../types';
import { normalizeAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { paymentMethodLabel } from '../../lib/constants';
import { todayISO } from '../../lib/utils';
import type { Coordinates } from '../../lib/geo';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import { useEntrySuggestions } from '../../hooks/useEntrySuggestions';
import { categoryNoteKey, pinnedNotesKey, selectNoteSuggestions, togglePin } from '../../lib/suggestions';
import { loadStringList, saveStringList } from '../../lib/search';
import { useUIStore } from '../../store/uiStore';
import type { TransactionInput } from '../../hooks/useTransactions';
import { AmountInput } from '../common/AmountInput';
import { CategoryPicker } from '../common/CategoryPicker';
import { CurrencySelector } from '../common/CurrencySelector';
import { LocationPicker } from '../common/LocationPicker';
import { Modal } from '../common/Modal';
import { MoveToTripModal } from '../trip/MoveToTripModal';

interface TransactionFormProps {
  initialLedgerType: LedgerType;
  onSubmit: (input: TransactionInput) => Promise<void>;
  onClose: () => void;
  initialTransaction?: Transaction | null;
  /** 有傳入時，編輯支出可「移到旅遊帳本」（搬過去後用它刪掉原本那筆）。 */
  onDelete?: (transactionId: string) => Promise<void>;
}

export function TransactionForm({ initialLedgerType, onSubmit, onClose, initialTransaction, onDelete }: TransactionFormProps) {
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
  const [movingToTrip, setMovingToTrip] = useState(false);
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories(type);
  const { members } = useFamilyMembers();
  const { noteHistory, noteDefaults, notesByCategory, categoryNoteDefaults } = useEntrySuggestions(ledgerType, type);
  const showToast = useUIStore((state) => state.showToast);
  const [pinnedNotes, setPinnedNotes] = useState<string[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(
    initialTransaction?.latitude != null && initialTransaction?.longitude != null
      ? { latitude: initialTransaction.latitude, longitude: initialTransaction.longitude }
      : null
  );
  const [placeName, setPlaceName] = useState(initialTransaction?.place_name ?? '');

  // 釘選清單依帳本／收支型別分開存；切換時重讀。
  useEffect(() => {
    setPinnedNotes(loadStringList(localStorage, pinnedNotesKey(ledgerType, type)));
  }, [ledgerType, type]);

  // 備註圓籤跟著分類走：選哪個分類就列那個分類用過的備註；輸入文字時再補上其他分類的相符備註。
  const noteSuggestions = selectNoteSuggestions({
    categoryId,
    query: note,
    pinned: pinnedNotes,
    notesByCategory,
    allNotes: noteHistory,
    noteDefaults
  });

  /** 點圓籤：帶入備註＋該備註上次的分類與付款方式；金額只在尚未輸入時帶入（不覆蓋）。 */
  function applySuggestion(suggestion: string) {
    setNote(suggestion);
    // 這個分類用過的備註：帶入它在此分類的金額／付款方式，分類不動。
    // 其他分類的備註（輸入搜尋時出現）：沿用它最近一次的分類並切換過去。
    const scoped = categoryNoteDefaults.get(categoryNoteKey(categoryId, suggestion));
    const defaults = scoped ?? noteDefaults.get(suggestion);
    if (!defaults) return;
    if (!scoped && defaults.category_id && categories.some((category) => category.id === defaults.category_id)) {
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
    setCoords(
      initialTransaction?.latitude != null && initialTransaction?.longitude != null
        ? { latitude: initialTransaction.latitude, longitude: initialTransaction.longitude }
        : null
    );
    setPlaceName(initialTransaction?.place_name ?? '');
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
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        place_name: coords ? placeName : null,
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

  // 「更多選項」收合時的摘要，讓使用者不用展開也看得到目前的日期／付款／歸屬／地點。
  const ownerName =
    ledgerType === 'family' && members.length > 1 ? members.find((member) => member.id === ownerId)?.display_name : undefined;
  const moreSummary = [
    transactionDate === todayISO() ? '今天' : transactionDate.slice(5).replace('-', '/'),
    paymentMethodLabel(paymentMethod),
    ownerName,
    coords ? '📍' : undefined
  ]
    .filter(Boolean)
    .join(' · ');

  const noteField = (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      備註
      <textarea
        className="min-h-20 rounded-lg border border-slate-300 bg-card px-3 py-2 text-slate-900 outline-none focus:border-action focus:ring-2 focus:ring-action/30"
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
                  pinned ? 'border-action bg-actionSoft text-action' : 'border-slate-200 bg-card text-slate-600'
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
  );

  const dialogTitle = initialTransaction ? '編輯交易' : '新增記帳';

  if (movingToTrip && initialTransaction && onDelete) {
    return (
      <MoveToTripModal
        transaction={initialTransaction}
        onDeleteOriginal={onDelete}
        onMoved={onClose}
        onClose={() => setMovingToTrip(false)}
      />
    );
  }

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
                  ledgerType === option ? 'bg-card text-slate-900 shadow-sm' : 'text-slate-500'
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
          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            onCreate={createCategory}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
          />

          {noteField}

          <details className="group rounded-lg border border-slate-200">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium text-slate-700">更多選項</span>
              <span className="truncate text-slate-500">{moreSummary}</span>
            </summary>
            <div className="grid gap-5 border-t border-slate-200 p-4">
          <div className="flex gap-2">
            {(['cash', 'card'] as PaymentMethod[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  paymentMethod === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
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
                        ? 'border-action bg-actionSoft text-action'
                        : 'border-slate-200 bg-card text-slate-600'
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

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            日期
            <input
              className="h-11 rounded-lg border border-slate-300 bg-card px-3 text-slate-900 outline-none focus:border-action focus:ring-2 focus:ring-action/30"
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
            />
          </label>


          <LocationPicker
            coords={coords}
            placeName={placeName}
            onChange={(nextCoords, nextName) => {
              setCoords(nextCoords);
              setPlaceName(nextName);
            }}
            onPhotoDate={setTransactionDate}
            autoLocateOnMount={!initialTransaction}
          />
            </div>
          </details>

          {initialTransaction?.type === 'expense' && onDelete ? (
            <button
              className="h-12 rounded-lg border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={() => setMovingToTrip(true)}
            >
              ✈️ 記錯了？移到旅遊帳本
            </button>
          ) : null}

          {/* 儲存鈕黏在畫面底部：表單再長也不用捲到最下面才能存。 */}
          <div className="sticky -bottom-5 -mx-5 -mb-5 grid gap-3 rounded-b-xl border-t border-slate-200 bg-card px-5 py-3 shadow-[0_-10px_24px_-14px_rgb(var(--shadow)/0.35)]">
            {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
            <button
              className="h-12 rounded-lg bg-action px-4 font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? '儲存中...' : initialTransaction ? '更新交易' : '儲存交易'}
            </button>
          </div>
      </form>
    </Modal>
  );
}
