import { useMemo, useState, type FormEvent } from 'react';
import type { PaymentMethod } from '../../types';
import { getErrorMessage } from '../../lib/errors';
import { paymentMethodLabel } from '../../lib/constants';
import {
  TRIP_CATEGORIES,
  TRIP_CURRENCIES,
  defaultExpenseDate,
  formatRate,
  formatTripAmount,
  formatTwd,
  parseRate,
  parseTripAmount,
  tripCurrency,
  type Trip,
  type TripExpense
} from '../../lib/trips';
import { todayISO } from '../../lib/utils';
import type { TripExpenseInput } from '../../hooks/useTrips';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import type { Coordinates } from '../../lib/geo';
import { AmountInput } from '../common/AmountInput';
import { LocationPicker } from '../common/LocationPicker';
import { Modal } from '../common/Modal';

interface TripExpenseFormProps {
  trip: Trip;
  /** 本趟已記過的花費：用來帶入各幣別上次用的匯率。 */
  expenses: TripExpense[];
  initialExpense?: TripExpense | null;
  onSubmit: (input: TripExpenseInput) => Promise<void>;
  onClose: () => void;
}

const inputClass = 'rounded-lg border border-slate-300 px-3 py-3 text-base';

export function TripExpenseForm({ trip, expenses, initialExpense, onSubmit, onClose }: TripExpenseFormProps) {
  const profile = useAuthStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const { members } = useFamilyMembers();

  const [currency, setCurrency] = useState(initialExpense?.currency ?? trip.local_currency);
  const [rate, setRate] = useState(formatRate(initialExpense?.rate ?? trip.rate));
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : '');
  const [category, setCategory] = useState(initialExpense?.category ?? 'food');
  const [date, setDate] = useState(initialExpense?.expense_date ?? defaultExpenseDate(trip, todayISO()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialExpense?.payment_method ?? 'cash');
  const [paidBy, setPaidBy] = useState(initialExpense?.paid_by ?? profile?.id ?? '');
  const [note, setNote] = useState(initialExpense?.note ?? '');
  const [coords, setCoords] = useState<Coordinates | null>(
    initialExpense?.latitude != null && initialExpense?.longitude != null
      ? { latitude: initialExpense.latitude, longitude: initialExpense.longitude }
      : null
  );
  const [placeName, setPlaceName] = useState(initialExpense?.place_name ?? '');
  const [saving, setSaving] = useState(false);

  // 各幣別在本趟最近用過的匯率（expenses 由新到舊，先看到的就是最近的）。
  const lastRates = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) if (!map.has(expense.currency)) map.set(expense.currency, expense.rate);
    return map;
  }, [expenses]);

  // 旅行當地幣別、TWD，再加上本趟用過的其他幣別，最後是其餘可選幣別。
  const currencyOptions = useMemo(() => {
    const preferred = [trip.local_currency, 'TWD', ...lastRates.keys()];
    const ordered = [...new Set(preferred)];
    for (const item of TRIP_CURRENCIES) if (!ordered.includes(item.code)) ordered.push(item.code);
    return ordered;
  }, [lastRates, trip.local_currency]);

  function changeCurrency(code: string) {
    setCurrency(code);
    const next =
      code === 'TWD' ? 1 : code === trip.local_currency ? trip.rate : (lastRates.get(code) ?? tripCurrency(code).hintRate);
    setRate(formatRate(next));
    // 切換幣別後依新幣別的小數位重新取整。
    const parsed = parseTripAmount(amount, code);
    if (amount && parsed > 0) setAmount(String(parsed));
  }

  const parsedAmount = parseTripAmount(amount, currency);
  const parsedRate = currency === 'TWD' ? 1 : parseRate(rate);
  const twdPreview = parsedRate ? Math.round(parsedAmount * parsedRate) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsedAmount <= 0) return showToast('請輸入金額', 'error');
    if (!parsedRate) return showToast('請輸入正確的匯率', 'error');

    setSaving(true);
    try {
      await onSubmit({
        expense_date: date,
        amount: parsedAmount,
        currency,
        rate: parsedRate,
        category,
        payment_method: paymentMethod,
        note,
        paid_by: paidBy || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        place_name: coords ? placeName : null
      });
      onClose();
    } catch (error) {
      showToast(getErrorMessage(error, '儲存失敗，請稍後再試。'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={initialExpense ? '編輯旅行花費' : '新增旅行花費'}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <h2 className="text-lg font-bold text-slate-900">
          {initialExpense ? '編輯花費' : '記一筆'}・{trip.name}
        </h2>

        <div className="flex flex-wrap gap-2" role="group" aria-label="幣別">
          {currencyOptions.slice(0, 6).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={currency === code}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${currency === code ? 'bg-family text-white' : 'bg-slate-100 text-slate-600'}`}
              onClick={() => changeCurrency(code)}
            >
              {code}
            </button>
          ))}
          <select
            aria-label="其他幣別"
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600"
            value={currencyOptions.slice(0, 6).includes(currency) ? '' : currency}
            onChange={(e) => e.target.value && changeCurrency(e.target.value)}
          >
            <option value="">其他</option>
            {currencyOptions.slice(6).map((code) => (
              <option key={code} value={code}>
                {tripCurrency(code).label}
              </option>
            ))}
          </select>
        </div>

        <AmountInput
          // AmountInput 的 currency 只用在預設格式化；這裡兩個自訂 prop 會蓋掉，傳 TWD 僅為滿足型別。
          currency="TWD"
          value={amount}
          onChange={setAmount}
          formatResult={(value) => formatTripAmount(parseTripAmount(String(value), currency), currency)}
          hint={`${currency} ${tripCurrency(currency).decimals === 0 ? '自動取整數' : `${tripCurrency(currency).decimals} 位小數`}`}
        />

        {currency !== 'TWD' ? (
          <div className="grid gap-2 rounded-lg bg-familySoft p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
              匯率（1 {currency} = ? 台幣）
              <input
                aria-label="匯率"
                className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-base"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
            <p className="text-right text-sm font-semibold text-family">
              ≈ {twdPreview === null ? '—' : formatTwd(twdPreview)}
            </p>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">分類</p>
          <div className="grid grid-cols-4 gap-2">
            {TRIP_CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={category === item.key}
                className={`grid justify-items-center gap-1 rounded-lg border px-1 py-2 text-xs font-semibold ${
                  category === item.key ? 'border-family bg-familySoft text-family' : 'border-slate-200 text-slate-600'
                }`}
                onClick={() => setCategory(item.key)}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            日期
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            誰付的
            <select className={inputClass} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2" role="group" aria-label="付款方式">
          {(['cash', 'card'] as PaymentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={paymentMethod === method}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                paymentMethod === method ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setPaymentMethod(method)}
            >
              {paymentMethodLabel(method)}
            </button>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          備註（可選）
          <input className={inputClass} value={note} placeholder="一蘭拉麵、地鐵一日券…" onChange={(e) => setNote(e.target.value)} />
        </label>

        <LocationPicker
          coords={coords}
          placeName={placeName}
          onChange={(nextCoords, nextName) => {
            setCoords(nextCoords);
            setPlaceName(nextName);
          }}
          onPhotoDate={setDate}
          autoLocateOnMount={!initialExpense}
        />

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-600" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-family px-4 py-3 font-semibold text-white disabled:opacity-60">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
