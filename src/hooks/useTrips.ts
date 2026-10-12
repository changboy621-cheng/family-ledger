import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaymentMethod } from '../types';
import { supabase } from '../lib/supabase';
import { parseTripExpenses, parseTrips } from '../lib/schemas';
import type { Trip, TripExpense } from '../lib/trips';
import { resolveLocationPatch } from './useTransactions';
import { useAuthStore } from '../store/authStore';

export interface TripInput {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
  local_currency: string;
  rate: number;
  budget_twd?: number | null;
}

export interface TripExpenseInput {
  expense_date: string;
  amount: number;
  currency: string;
  rate: number;
  category: string;
  payment_method?: PaymentMethod | null;
  note?: string;
  paid_by?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  place_name?: string | null;
}

/** 旅行清單：新到舊。 */
export function useTrips() {
  const familyId = useAuthStore((state) => state.profile?.family_id);
  const profileId = useAuthStore((state) => state.profile?.id);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) return;
    const { data, error: fetchError } = await supabase
      .from('trips')
      .select('*')
      .eq('family_id', familyId)
      .order('start_date', { ascending: false });
    if (fetchError) {
      console.error('[useTrips] 讀取旅行失敗', fetchError);
      setError(true);
    } else {
      setTrips(parseTrips(data));
      setError(false);
    }
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTrip = useCallback(
    async (input: TripInput) => {
      if (!familyId) throw new Error('尚未加入家庭，無法建立旅行。');
      const { data, error: insertError } = await supabase
        .from('trips')
        .insert({
          ...input,
          name: input.name.trim(),
          destination: input.destination?.trim() || null,
          budget_twd: input.budget_twd ?? null,
          family_id: familyId,
          created_by: profileId ?? null
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      await load();
      return parseTrips([data])[0] ?? null;
    },
    [familyId, load, profileId]
  );

  return { trips, loading, error, reload: load, createTrip };
}

/** 單趟旅行：旅行本身＋全部花費，並提供花費的新增／修改／刪除。 */
export function useTripDetail(tripId: string | undefined) {
  const familyId = useAuthStore((state) => state.profile?.family_id);
  const profileId = useAuthStore((state) => state.profile?.id);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!familyId || !tripId) return;
    const requestId = ++requestIdRef.current;
    const [tripResult, expenseResult] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).eq('family_id', familyId).maybeSingle(),
      supabase
        .from('trip_expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000)
    ]);
    if (requestId !== requestIdRef.current) return;

    if (tripResult.error || expenseResult.error) {
      console.error('[useTripDetail] 讀取旅行失敗', tripResult.error ?? expenseResult.error);
      setError(true);
    } else {
      setTrip(tripResult.data ? (parseTrips([tripResult.data])[0] ?? null) : null);
      setExpenses(parseTripExpenses(expenseResult.data));
      setError(false);
    }
    setLoading(false);
  }, [familyId, tripId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // 回到前景時重抓：另一半在同一趟旅行記的帳，這邊切回 App 就會看到。
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') void load();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const addExpense = useCallback(
    async (input: TripExpenseInput) => {
      if (!familyId || !tripId) throw new Error('找不到這趟旅行。');
      const { error: insertError } = await supabase.from('trip_expenses').insert({
        ...input,
        ...resolveLocationPatch(input),
        note: input.note?.trim() || null,
        payment_method: input.payment_method ?? null,
        paid_by: input.paid_by ?? profileId ?? null,
        recorded_by: profileId ?? null,
        trip_id: tripId,
        family_id: familyId
      });
      if (insertError) throw insertError;
      await load();
    },
    [familyId, load, profileId, tripId]
  );

  const updateExpense = useCallback(
    async (id: string, input: TripExpenseInput) => {
      const { error: updateError } = await supabase
        .from('trip_expenses')
        .update({
          ...input,
          ...resolveLocationPatch(input),
          note: input.note?.trim() || null,
          payment_method: input.payment_method ?? null,
          paid_by: input.paid_by ?? profileId ?? null
        })
        .eq('id', id);
      if (updateError) throw updateError;
      await load();
    },
    [load, profileId]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('trip_expenses').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await load();
    },
    [load]
  );

  const updateTrip = useCallback(
    async (input: TripInput) => {
      if (!tripId) throw new Error('找不到這趟旅行。');
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          ...input,
          name: input.name.trim(),
          destination: input.destination?.trim() || null,
          budget_twd: input.budget_twd ?? null
        })
        .eq('id', tripId);
      if (updateError) throw updateError;
      await load();
    },
    [load, tripId]
  );

  const deleteTrip = useCallback(async () => {
    if (!tripId) return;
    const { error: deleteError } = await supabase.from('trips').delete().eq('id', tripId);
    if (deleteError) throw deleteError;
  }, [tripId]);

  return { trip, expenses, loading, error, reload: load, addExpense, updateExpense, deleteExpense, updateTrip, deleteTrip };
}
