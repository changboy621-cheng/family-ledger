import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../lib/errors';
import { todayISO } from '../../lib/utils';
import { TRIP_CURRENCIES, formatRate, parseRate, tripCurrency, type Trip } from '../../lib/trips';
import type { TripInput } from '../../hooks/useTrips';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../common/Modal';

interface TripFormProps {
  initialTrip?: Trip | null;
  onSubmit: (input: TripInput) => Promise<void>;
  onClose: () => void;
}

const inputClass = 'rounded-lg border border-slate-300 px-3 py-3 text-base';

export function TripForm({ initialTrip, onSubmit, onClose }: TripFormProps) {
  const showToast = useUIStore((state) => state.showToast);
  const [name, setName] = useState(initialTrip?.name ?? '');
  const [destination, setDestination] = useState(initialTrip?.destination ?? '');
  const [startDate, setStartDate] = useState(initialTrip?.start_date ?? todayISO());
  const [endDate, setEndDate] = useState(initialTrip?.end_date ?? todayISO());
  const [currency, setCurrency] = useState(initialTrip?.local_currency ?? 'JPY');
  const [rate, setRate] = useState(initialTrip ? formatRate(initialTrip.rate) : formatRate(tripCurrency('JPY').hintRate));
  const [budget, setBudget] = useState(initialTrip?.budget_twd ? String(initialTrip.budget_twd) : '');
  const [saving, setSaving] = useState(false);

  function changeCurrency(code: string) {
    setCurrency(code);
    setRate(formatRate(tripCurrency(code).hintRate));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedRate = parseRate(rate);
    const parsedBudget = budget.trim() ? Number(budget) : null;

    if (!name.trim()) return showToast('請輸入旅行名稱', 'error');
    if (!parsedRate) return showToast('請輸入正確的匯率', 'error');
    if (endDate < startDate) return showToast('回程日期不能早於出發日期', 'error');
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
      return showToast('預算請輸入大於 0 的數字，或留白', 'error');
    }

    setSaving(true);
    try {
      await onSubmit({
        name,
        destination,
        start_date: startDate,
        end_date: endDate,
        local_currency: currency,
        rate: parsedRate,
        budget_twd: parsedBudget
      });
      onClose();
    } catch (error) {
      showToast(getErrorMessage(error, '儲存旅行失敗，請稍後再試。'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={initialTrip ? '編輯旅行' : '新增旅行'}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <h2 className="text-lg font-bold text-slate-900">{initialTrip ? '編輯旅行' : '新增旅行'}</h2>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          旅行名稱
          <input className={inputClass} value={name} maxLength={60} placeholder="例如：2026 東京五日遊" onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          目的地（可選）
          <input className={inputClass} value={destination} placeholder="東京・大阪" onChange={(e) => setDestination(e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            出發日
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            回程日
            <input type="date" className={inputClass} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            當地幣別
            <select className={inputClass} value={currency} onChange={(e) => changeCurrency(e.target.value)}>
              {TRIP_CURRENCIES.filter((item) => item.code !== 'TWD').map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            匯率（1 {currency} = ? 台幣）
            <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
        </div>
        <p className="-mt-2 text-xs text-slate-400">預填的是約略參考值，請改成你實際換匯／刷卡的匯率；每筆花費之後也能各自調整。</p>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          旅行預算（新台幣，可選）
          <input className={inputClass} inputMode="numeric" value={budget} placeholder="例如 80000" onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ''))} />
        </label>

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
