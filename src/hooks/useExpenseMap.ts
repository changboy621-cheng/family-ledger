import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LedgerType, Transaction } from '../types';
import { parseTransactions } from '../lib/schemas';
import { buildMapPlaces } from '../lib/geo';
import { useAuthStore } from '../store/authStore';
import { fetchTransactions } from './useTransactions';

/** 消費地圖的範圍：從哪天起算；'all' = 不限（從有記帳以來）。 */
export type MapPeriod = 'all' | 'year' | '90d';

function periodFrom(period: MapPeriod, now = new Date()): string {
  if (period === 'all') return '1900-01-01';
  const start = period === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - 90 * 86_400_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/** 讀取有定位的支出並聚合成地圖上的地點。 */
export function useExpenseMap(ledgerType: LedgerType, period: MapPeriod) {
  const profile = useAuthStore((state) => state.profile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const { data, error: fetchError } = await fetchTransactions({
      ledgerType,
      profile: { id: profile.id, family_id: profile.family_id },
      from: periodFrom(period),
      to: '9999-12-31'
    })
      .eq('type', 'expense')
      .not('latitude', 'is', null)
      .limit(5000);
    if (requestId !== requestIdRef.current) return;
    if (fetchError) {
      console.error('[useExpenseMap] 讀取消費地圖失敗', fetchError);
      setError(true);
    } else {
      setTransactions(parseTransactions(data));
      setError(false);
    }
    setLoading(false);
  }, [ledgerType, period, profile?.family_id, profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const places = useMemo(() => buildMapPlaces(transactions), [transactions]);

  return { places, transactions, loading, error, reload: load };
}
