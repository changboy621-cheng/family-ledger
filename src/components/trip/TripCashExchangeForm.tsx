import { useMemo, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../lib/errors';
import {
  TRIP_CURRENCIES,
  formatRate,
  formatTripAmount,
  formatTwd,
  parseRate,
  parseTripAmount,
  tripCurrency,
  type Trip,
  type TripCashExchange
} from '../../lib/trips';
import { todayISO } from '../../lib/utils';
import type { TripCashExchangeInput } from '../../hooks/useTrips';
import { useUIStore } from '../../store/uiStore';
import { AmountInput } from '../common/AmountInput';
import { Modal } from '../common/Modal';

interface TripCashExchangeFormProps {
  trip: Trip;
  /** 本趟已記過的換匯：用來帶入各幣別上次換的匯率。 */
  exchanges: TripCashExchange[];
  initialExchange?: TripCashExchange | null;
  onSubmit: (input: TripCashExchangeInput) => Promise<void>;
  onClose: () => void;
}

const inputClass = 'rounded-lg border border-slate-300 px-3 py-3 text-base';

export function TripCashExchangeForm({ trip, exchanges, initialExchange, onSubmit, onClose }: TripCashExchangeFormProps) {
  const showToast = useUIStore((state) => state.showToast);

  // 各幣別在本趟最近一次換匯的匯率（exchanges 由新到舊）。
  const lastRates = useMemo(() => {
    const map = new Map<string, number>();
    for (const exchange of exchanges) if (!map.has(exchange.currency)) map.set(exchange.currency, exchange.rate);
    return map;
  }, [exchanges]);

  const rateFor = (code: string) =>
    lastRates.get(code) ?? (code === trip.local_currency ? trip.rate : tripCurrency(code).hintRate);

  const [currency, setCurrency] = useState(initialExchange?.currency ?? trip.local_currency);
  const [rate, setRate] = useState(formatRate(initialExchange?.rate ?? rateFor(initialExchange?.currency ?? trip.local_currency)));
  const [amount, setAmount] = useState(initialExchange ? String(initialExchange.amount) : '');
  const [date, setDate] = useState(initialExchange?.exchange_date ?? todayISO());
  const [note, setNote] = useState(initialExchange?.note ?? '');
  const [saving, setSaving] = useState(false);

  // 換匯不會換台幣：當地幣別優先，再來是本趟換過的，其餘依清單。
  const currencyOptions = useMemo(() => {
    const ordered = [...new Set([trip.local_currency, ...lastRates.keys()])].filter((code) => code !== 'TWD');
    for (const item of TRIP_CURRENCIES) if (item.code !== 'TWD' && !ordered.includes(item.code)) ordered.push(item.code);
    return ordered;
  }, [lastRates, trip.local_currency]);

  function changeCurrency(code: string) {
    setCurrency(code);
    setRate(formatRate(rateFor(code)));
    const parsed = parseTripAmount(amount, code);
    if (amount && parsed > 0) setAmount(String(parsed));
  }

  const parsedAmount = parseTripAmount(amount, currency);
  const parsedRate = parseRate(rate);
  const twdPreview = parsedRate ? Math.round(parsedAmount * parsedRate) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsedAmount <= 0) return showToast('請輸入換到的金額', 'error');
    if (!parsedRate) return showToast('請輸入正確的匯率', 'error');

    setSaving(true);
    try {
      await onSubmit({ exchange_date: date, currency, amount: parsedAmount, rate: parsedRate, note });
      onClose();
    } catch (error) {
      showToast(getErrorMessage(error, '儲存失敗，請稍後再試。'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={initialExchange ? '編輯換匯' : '新增換匯'}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{initialExchange ? '編輯換匯' : '換了多少現金'}</h2>
          <p className="mt-1 text-xs text-slate-500">之後用「現金」記的花費會自動從這裡扣掉，隨時看到手邊還剩多少。</p>
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          幣別
          <select className={inputClass} value={currency} onChange={(e) => changeCurrency(e.target.value)}>
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {tripCurrency(code).label}
              </option>
            ))}
          </select>
        </label>

        <AmountInput
          // 同 TripExpenseForm：currency 只為滿足型別，顯示由 formatResult／hint 決定。
          currency="TWD"
          value={amount}
          onChange={setAmount}
          formatResult={(value) => formatTripAmount(parseTripAmount(String(value), currency), currency)}
          hint={`換到的 ${currency} 金額，可輸入 10000+5000`}
        />

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
            花了 ≈ {twdPreview === null ? '—' : formatTwd(twdPreview)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            日期
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            備註（可選）
            <input className={inputClass} value={note} placeholder="台銀、機場…" onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

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
