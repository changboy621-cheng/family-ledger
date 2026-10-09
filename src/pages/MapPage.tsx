import { useState } from 'react';
import type { Currency, LedgerType } from '../types';
import { formatAmount } from '../lib/currency';
import { useExpenseMap, type MapPeriod } from '../hooks/useExpenseMap';
import { ExpenseMap } from '../components/map/ExpenseMap';

const PERIODS: { value: MapPeriod; label: string }[] = [
  { value: '90d', label: '近 90 天' },
  { value: 'year', label: '今年' },
  { value: 'all', label: '全部' }
];

export function MapPage() {
  const [ledgerType, setLedgerType] = useState<LedgerType>('family');
  const [period, setPeriod] = useState<MapPeriod>('year');
  const [currency, setCurrency] = useState<Currency>('TWD');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { places, loading, error, reload } = useExpenseMap(ledgerType, period);

  const visiblePlaces = places.filter((place) => place.totals[currency] > 0);
  const total = visiblePlaces.reduce((sum, place) => sum + place.totals[currency], 0);
  const topPlaces = [...visiblePlaces].sort((a, b) => b.totals[currency] - a.totals[currency]).slice(0, 10);

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold text-slate-500">足跡</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">消費地圖</h1>
        <p className="mt-1 text-sm text-slate-500">記帳時記錄位置，就會在這裡長出你們的消費足跡。</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['family', 'personal'] as LedgerType[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              ledgerType === option ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
            }`}
            onClick={() => {
              setLedgerType(option);
              setSelectedKey(null);
            }}
          >
            {option === 'family' ? '家庭帳本' : '個人帳本'}
          </button>
        ))}
        <span className="w-2" />
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              period === option.value ? 'bg-family text-white' : 'bg-white text-slate-600'
            }`}
            onClick={() => setPeriod(option.value)}
          >
            {option.label}
          </button>
        ))}
        <span className="w-2" />
        {(['TWD', 'USD'] as Currency[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              currency === option ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
            }`}
            onClick={() => setCurrency(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {error ? (
        <section className="rounded-xl border border-red-200 bg-white p-4 text-sm text-slate-600">
          消費地圖載入失敗。
          <button type="button" className="ml-2 font-semibold text-family" onClick={() => void reload()}>
            重試
          </button>
        </section>
      ) : null}

      <ExpenseMap places={visiblePlaces} currency={currency} selectedKey={selectedKey} onSelect={setSelectedKey} />

      {!loading && !error && visiblePlaces.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          這個範圍還沒有帶位置的{currency}支出。新增記帳時按「記錄目前位置」（或勾選「新增記帳時自動記錄位置」）就會出現在地圖上。
        </section>
      ) : null}

      {topPlaces.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-900">
            花最多的地方 <span className="text-sm font-normal text-slate-400">共 {visiblePlaces.length} 處・{formatAmount(total, currency)}</span>
          </h2>
          <ul className="mt-3 grid gap-2">
            {topPlaces.map((place) => (
              <li key={place.key}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${
                    selectedKey === place.key ? 'border-family bg-familySoft' : 'border-slate-200'
                  }`}
                  onClick={() => setSelectedKey(place.key)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">
                      📍 {place.name ?? `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`}
                    </span>
                    <span className="text-xs text-slate-500">
                      {place.count} 筆・最近 {place.lastDate}
                    </span>
                  </span>
                  <strong className="shrink-0 text-red-500">{formatAmount(place.totals[currency], currency)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
