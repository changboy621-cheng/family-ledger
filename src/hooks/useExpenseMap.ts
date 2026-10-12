import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseTransactions, parseTripExpenses } from '../lib/schemas';
import { buildMapPlacesFromSpots, transactionToSpot, tripExpenseToSpot, type MapSource, type MapSpot } from '../lib/geo';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { fetchTransactions } from './useTransactions';

/** 消費地圖的範圍：從哪天起算；'all' = 不限（從有記帳以來）。 */
export type MapPeriod = 'all' | 'year' | '90d';

/** 地圖要顯示哪些帳：全部，或單一來源。 */
export type MapSourceFilter = MapSource | 'all';

function periodFrom(period: MapPeriod, now = new Date()): string {
  if (period === 'all') return '1900-01-01';
  const start = period === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - 90 * 86_400_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/**
 * 讀取家庭、個人、旅遊三種帳有定位的支出，聚合成地圖上的地點。
 * 三種來源一次抓回，切換來源只在前端過濾（不重抓）；旅遊花費已折合新台幣。
 */
export function useExpenseMap(source: MapSourceFilter, period: MapPeriod) {
  const profile = useAuthStore((state) => state.profile);
  const [spots, setSpots] = useState<MapSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const from = periodFrom(period);
    const owner = { id: profile.id, family_id: profile.family_id };

    const [family, personal, trips] = await Promise.all([
      fetchTransactions({ ledgerType: 'family', profile: owner, from, to: '9999-12-31' })
        .eq('type', 'expense')
        .not('latitude', 'is', null)
        .limit(5000),
      fetchTransactions({ ledgerType: 'personal', profile: owner, from, to: '9999-12-31' })
        .eq('type', 'expense')
        .not('latitude', 'is', null)
        .limit(5000),
      supabase
        .from('trip_expenses')
        .select('*')
        .eq('family_id', profile.family_id)
        .gte('expense_date', from)
        .not('latitude', 'is', null)
        .limit(5000)
    ]);
    if (requestId !== requestIdRef.current) return;

    // 旅遊表（010／011 migration）尚未建立時，不要讓整張地圖壞掉：只是少了旅遊的點。
    const failed = family.error ?? personal.error;
    if (failed) {
      console.error('[useExpenseMap] 讀取消費地圖失敗', failed);
      setError(true);
    } else {
      if (trips.error) console.warn('[useExpenseMap] 讀取旅遊花費位置失敗（略過旅遊）', trips.error);
      const all = [
        ...parseTransactions(family.data).map(transactionToSpot),
        ...parseTransactions(personal.data).map(transactionToSpot),
        ...(trips.error ? [] : parseTripExpenses(trips.data).map(tripExpenseToSpot))
      ];
      setSpots(all.filter((spot): spot is MapSpot => spot !== null));
      setError(false);
    }
    setLoading(false);
  }, [period, profile?.family_id, profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const places = useMemo(
    () => buildMapPlacesFromSpots(source === 'all' ? spots : spots.filter((spot) => spot.source === source)),
    [spots, source]
  );

  /** 各來源有定位的筆數，用來在篩選鈕上顯示。 */
  const counts = useMemo(() => {
    const result: Record<MapSource, number> = { family: 0, personal: 0, trip: 0 };
    for (const spot of spots) result[spot.source] += 1;
    return result;
  }, [spots]);

  return { places, counts, loading, error, reload: load };
}
