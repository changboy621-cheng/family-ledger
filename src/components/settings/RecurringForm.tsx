import { useEffect, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, RecurringTransaction, TransactionType } from '../../types';
import { normalizeAmount } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { paymentMethodLabel } from '../../lib/constants';
import { defaultStartMonth, formatMonthDay, occurrenceDate, toYearMonth } from '../../lib/recurring';
import { todayISO } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useCategories } from '../../hooks/useCategories';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import type { RecurringInput } from '../../hooks/useRecurring';
import { CategoryPicker } from '../common/CategoryPicker';
import { CurrencySelector } from '../common/CurrencySelector';
import { Modal } from '../common/Modal';

interface RecurringFormProps {
  initialRule?: RecurringTransaction | null;
  onCreate: (input: RecurringInput, startMonth: string) => Promise<void>;
  onUpdate: (id: string, input: RecurringInput) => Promise<void>;
  onClose: () => void;
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const inputClass =
  'h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30';

// 新增／編輯固定收支。欄位與記帳表單一致，另加「每月幾號」；新增時若本月記入日已過，可選擇本月是否也記入。
export function RecurringForm({ initialRule, onCreate, onUpdate, onClose }: RecurringFormProps) {
  const profile = useAuthStore((state) => state.profile);
  const [ledgerType, setLedgerType] = useState<LedgerType>(initialRule?.ledger_type ?? 'family');
  const [type, setType] = useState<TransactionType>(initialRule?.type ?? 'expense');
  const [currency, setCurrency] = useState<Currency>(initialRule?.currency ?? profile?.default_currency ?? 'TWD');
  const [amount, setAmount] = useState(initialRule ? String(initialRule.amount) : '');
  const [categoryId, setCategoryId] = useState(initialRule?.category_id ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(initialRule?.day_of_month ?? new Date().getDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(initialRule?.payment_method ?? null);
  const [note, setNote] = useState(initialRule?.note ?? '');
  const [ownerId, setOwnerId] = useState(initialRule?.owner_id ?? profile?.id ?? '');
  const [includeThisMonth, setIncludeThisMonth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { categories, createCategory } = useCategories(type);
  const { members } = useFamilyMembers();

  const thisMonth = toYearMonth(new Date());
  const defaultStart = defaultStartMonth(dayOfMonth);
  // 本月記入日已過（預設從下個月開始）時，才需要問本月要不要也記入。
  const thisMonthPassed = !initialRule && defaultStart !== thisMonth;
  const startMonth = thisMonthPassed && includeThisMonth ? thisMonth : defaultStart;
  const firstDate = occurrenceDate(startMonth, dayOfMonth);

  // 與記帳表單一致：目前類別不在清單（初次載入、切換收支）時預設第一個，畫面顯示的就是會存的。
  useEffect(() => {
    if (categories.length > 0 && !categories.some((category) => category.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeAmount(amount, currency);
    if (normalized <= 0) {
      setError('請輸入大於 0 的金額。');
      return;
    }
    if (!categoryId) {
      setError('請選擇類別。');
      return;
    }

    const input: RecurringInput = {
      ledger_type: ledgerType,
      type,
      amount: normalized,
      currency,
      category_id: categoryId,
      note,
      payment_method: type === 'expense' ? paymentMethod : null,
      day_of_month: dayOfMonth,
      owner_id: ledgerType === 'family' ? ownerId : undefined
    };

    setSaving(true);
    setError('');
    try {
      if (initialRule) await onUpdate(initialRule.id, input);
      else await onCreate(input, startMonth);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle = initialRule ? '編輯固定收支' : '新增固定收支';

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
              aria-pressed={ledgerType === option}
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
              aria-pressed={type === option}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                type === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setType(option)}
            >
              {option === 'expense' ? '支出' : '收入'}
            </button>
          ))}
        </div>

        {ledgerType === 'family' && members.length > 1 ? (
          <div className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">這筆是誰的</span>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={ownerId === member.id}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    ownerId === member.id ? 'border-family bg-familySoft text-family' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                  onClick={() => setOwnerId(member.id)}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.avatar_color }} />
                  {member.display_name}
                  {member.id === profile?.id ? '（我）' : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <CurrencySelector value={currency} onChange={setCurrency} />

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          金額
          <input
            className={`${inputClass} text-right text-lg font-semibold`}
            inputMode={currency === 'TWD' ? 'numeric' : 'decimal'}
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} onCreate={createCategory} />

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          每月幾號
          <select className={inputClass} value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))}>
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {day} 號{day >= 29 ? '（短月份記在月底）' : ''}
              </option>
            ))}
          </select>
        </label>

        {thisMonthPassed ? (
          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-family"
              checked={includeThisMonth}
              onChange={(event) => setIncludeThisMonth(event.target.checked)}
            />
            <span>
              本月 {dayOfMonth} 號已過，這個月也要記入一筆
              <span className="block text-xs text-slate-400">如果這個月已經手動記過，就不要勾，避免重複。</span>
            </span>
          </label>
        ) : null}

        {type === 'expense' ? (
          <div className="flex gap-2">
            {([null, 'cash', 'card'] as Array<PaymentMethod | null>).map((option) => (
              <button
                key={option ?? 'none'}
                type="button"
                aria-pressed={paymentMethod === option}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  paymentMethod === option ? 'bg-family text-white' : 'bg-slate-100 text-slate-600'
                }`}
                onClick={() => setPaymentMethod(option)}
              >
                {option ? paymentMethodLabel(option) : '不指定'}
              </button>
            ))}
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          備註
          <input
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="房租、保費、Netflix、薪資、定期定額..."
          />
        </label>

        <p className="text-xs text-slate-500">
          {initialRule
            ? '修改只影響之後的月份，已記入的交易不會變動。'
            : firstDate <= todayISO()
              ? `建立後會立即記入本月（${formatMonthDay(firstDate)}）這一筆，之後每月一筆。`
              : `第一筆會在 ${formatMonthDay(firstDate)} 自動記入，之後每月一筆。`}
        </p>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

        <button className="h-12 rounded-lg bg-family px-4 font-semibold text-white disabled:opacity-60" type="submit" disabled={saving}>
          {saving ? '儲存中...' : initialRule ? '更新' : '建立'}
        </button>
      </form>
    </Modal>
  );
}

