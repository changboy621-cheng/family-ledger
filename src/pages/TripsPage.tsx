import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Plus } from 'lucide-react';
import { useTrips } from '../hooks/useTrips';
import { formatRate, tripStatus, type Trip } from '../lib/trips';
import { todayISO } from '../lib/utils';
import { useUIStore } from '../store/uiStore';
import { TripForm } from '../components/trip/TripForm';

const STATUS_LABEL = { ongoing: '旅行中', upcoming: '即將出發', past: '已結束' } as const;
const STATUS_STYLE = {
  ongoing: 'bg-family text-white',
  upcoming: 'bg-personalSoft text-personal',
  past: 'bg-slate-100 text-slate-500'
} as const;

function TripCard({ trip, today }: { trip: Trip; today: string }) {
  const status = tripStatus(trip, today);
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{trip.name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {trip.destination ? `${trip.destination}・` : ''}
          {trip.start_date} ~ {trip.end_date}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          1 {trip.local_currency} ≈ NT${formatRate(trip.rate)}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
        {STATUS_LABEL[status]}
      </span>
    </Link>
  );
}

export function TripsPage() {
  const { trips, loading, error, reload, createTrip } = useTrips();
  const showToast = useUIStore((state) => state.showToast);
  const [showForm, setShowForm] = useState(false);
  const today = todayISO();

  return (
    <div className="grid gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">出國專用</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">旅遊記帳</h1>
          <p className="mt-1 text-sm text-slate-500">每趟旅行一本獨立帳，多幣別、記下當時匯率，不會混進日常月報。</p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-full bg-family px-4 py-3 text-sm font-semibold text-white shadow"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          新旅行
        </button>
      </header>

      {error ? (
        <section className="rounded-xl border border-red-200 bg-white p-4 text-sm text-slate-600">
          旅行載入失敗，請確認已在 Supabase 執行 010_trips.sql。
          <button type="button" className="ml-2 font-semibold text-family" onClick={() => void reload()}>
            重試
          </button>
        </section>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">載入中…</p> : null}

      {!loading && !error && trips.length === 0 ? (
        <section className="grid justify-items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Plane className="h-8 w-8 text-family" />
          <p className="font-semibold text-slate-900">還沒有旅行</p>
          <p className="text-sm text-slate-500">出發前先建一趟旅行、設好匯率，到了當地一鍵記帳。</p>
        </section>
      ) : null}

      <div className="grid gap-3">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} today={today} />
        ))}
      </div>

      {showForm ? (
        <TripForm
          onClose={() => setShowForm(false)}
          onSubmit={async (input) => {
            await createTrip(input);
            showToast('已建立旅行');
          }}
        />
      ) : null}
    </div>
  );
}
