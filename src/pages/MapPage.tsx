import { useState } from 'react';
import type { Currency } from '../types';
import { formatAmount } from '../lib/currency';
import { useExpenseMap, type MapPeriod, type MapSourceFilter } from '../hooks/useExpenseMap';
import { ExpenseMap } from '../components/map/ExpenseMap';
import { COLOR_GROUPS, SOURCE_STYLE, colorSlices, sliceGradient } from '../lib/mapColors';

const SOURCES: { value: MapSourceFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'family', label: '家庭' },
  { value: 'personal', label: '個人' },
  { value: 'trip', label: '旅遊' }
];

const PERIODS: { value: MapPeriod; label: string }[] = [
  { value: '90d', label: '近 90 天' },
  { value: 'year', label: '今年' },
  { value: 'all', label: '全部' }
];

export function MapPage() {
  const [source, setSource] = useState<MapSourceFilter>('all');
  const [colorBy, setColorBy] = useState<'category' | 'source'>('category');
  const [period, setPeriod] = useState<MapPeriod>('year');
  const [currency, setCurrency] = useState<Currency>('TWD');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { places, counts, loading, error, reload } = useExpenseMap(source, period);

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
        {SOURCES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              source === option.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
            }`}
            onClick={() => {
              setSource(option.value);
              setSelectedKey(null);
            }}
          >
            {option.label}
            {option.value !== 'all' ? <span className="ml-1 text-xs opacity-60">{counts[option.value]}</span> : null}
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

      {source !== 'family' && source !== 'personal' && currency === 'USD' ? (
        <p className="text-xs text-slate-400">旅遊花費已折合新台幣，只會出現在 TWD 檢視。</p>
      ) : null}

      <ExpenseMap places={visiblePlaces} currency={currency} colorBy={colorBy} selectedKey={selectedKey} onSelect={setSelectedKey} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
        <span className="flex overflow-hidden rounded-full bg-white font-semibold">
          {(['category', 'source'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`px-3 py-1.5 ${colorBy === mode ? 'bg-slate-900 text-white' : ''}`}
              onClick={() => setColorBy(mode)}
            >
              {mode === 'category' ? '依項目分色' : '依帳本分色'}
            </button>
          ))}
        </span>
        {(colorBy === 'category'
          ? COLOR_GROUPS.map((group) => ({ key: group.key, label: group.label, color: group.color }))
          : (Object.keys(SOURCE_STYLE) as (keyof typeof SOURCE_STYLE)[]).map((key) => ({ key, ...SOURCE_STYLE[key] }))
        ).map((item) => (
          <span key={item.key} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <p className="-mt-3 text-xs text-slate-400">同一地點有幾種{colorBy === 'category' ? '項目' : '帳本'}，就疊幾個半透明的圓，重疊處會混色；圓的大小依該色的金額。</p>

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
                      <span
                        className="mr-1 inline-block h-3 w-3 rounded-full align-middle"
                        style={{ background: sliceGradient(colorSlices(place, currency, colorBy)) }}
                      />
                      📍 {place.name ?? `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`}
                    </span>
                    <span className="text-xs text-slate-500">
                      {place.count} 筆・最近 {place.lastDate}
                      {place.sources.trip > 0 ? `・✈️ 旅遊 ${place.sources.trip}` : ''}
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
