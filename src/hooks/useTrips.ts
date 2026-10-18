import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaymentMethod } from '../types';
import { supabase } from '../lib/supabase';
import { parseTripCashExchanges, parseTripExpenses, parseTrips } from '../lib/schemas';
import { setShareRepaid, type FriendShare, type RepaidMethod, type Trip, type TripCashExchange, type TripExpense } from '../lib/trips';
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
  /** 幫朋友代墊的部分；未提供視為沒有代墊。 */
  friend_shares?: FriendShare[];
}

export interface TripCashExchangeInput {
  exchange_date: string;
  currency: string;
  amount: number;
  rate: number;
  note?: string;
}

/**
 * 代墊欄位只在「有代墊」或「要清掉原有代墊」時才送出：
 * 尚未跑 013 migration 的資料庫沒有 friend_shares 欄位，一般記帳仍要能正常存。
 */
export function friendSharesPatch(input: Pick<TripExpenseInput, 'friend_shares'>, previous?: Pick<TripExpense, 'friend_shares'>) {
  const shares = input.friend_shares ?? [];
  const hadShares = (previous?.friend_shares ?? []).length > 0;
  return shares.length > 0 || hadShares ? { friend_shares: shares } : {};
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

/** 單趟旅行：旅行本身＋全部花費＋換匯紀錄，並提供新增／修改／刪除。 */
export function useTripDetail(tripId: string | undefined) {
  const familyId = useAuthStore((state) => state.profile?.family_id);
  const profileId = useAuthStore((state) => state.profile?.id);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [cashExchanges, setCashExchanges] = useState<TripCashExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!familyId || !tripId) return;
    const requestId = ++requestIdRef.current;
    const [tripResult, expenseResult, exchangeResult] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).eq('family_id', familyId).maybeSingle(),
      supabase
        .from('trip_expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('trip_cash_exchanges')
        .select('*')
        .eq('trip_id', tripId)
        .order('exchange_date', { ascending: false })
        .order('created_at', { ascending: false })
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
    // 換匯紀錄讀不到（例如尚未跑 012 migration）不擋整頁，只是不顯示手邊現金。
    if (exchangeResult.error) {
      console.error('[useTripDetail] 讀取換匯紀錄失敗', exchangeResult.error);
      setCashExchanges([]);
    } else {
      setCashExchanges(parseTripCashExchanges(exchangeResult.data));
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
      const fields = { ...input };
      delete fields.friend_shares;
      const { error: insertError } = await supabase.from('trip_expenses').insert({
        ...fields,
        ...resolveLocationPatch(input),
        ...friendSharesPatch(input),
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
      const fields = { ...input };
      delete fields.friend_shares;
      const { error: updateError } = await supabase
        .from('trip_expenses')
        .update({
          ...fields,
          ...resolveLocationPatch(input),
          ...friendSharesPatch(input, expenses.find((expense) => expense.id === id)),
          note: input.note?.trim() || null,
          payment_method: input.payment_method ?? null,
          paid_by: input.paid_by ?? profileId ?? null
        })
        .eq('id', id);
      if (updateError) throw updateError;
      await load();
    },
    [expenses, load, profileId]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('trip_expenses').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await load();
    },
    [load]
  );

  // 朋友還錢（或改回未還）：只改那筆代墊的還款狀態，其餘欄位不動。
  const setFriendShareRepaid = useCallback(
    async (expense: TripExpense, shareId: string, repaid: { date: string; method: RepaidMethod } | null) => {
      const { error: updateError } = await supabase
        .from('trip_expenses')
        .update({ friend_shares: setShareRepaid(expense.friend_shares ?? [], shareId, repaid) })
        .eq('id', expense.id);
      if (updateError) throw updateError;
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

  const addCashExchange = useCallback(
    async (input: TripCashExchangeInput) => {
      if (!familyId || !tripId) throw new Error('找不到這趟旅行。');
      const { error: insertError } = await supabase.from('trip_cash_exchanges').insert({
        ...input,
        note: input.note?.trim() || null,
        recorded_by: profileId ?? null,
        trip_id: tripId,
        family_id: familyId
      });
      if (insertError) throw insertError;
      await load();
    },
    [familyId, load, profileId, tripId]
  );

  const updateCashExchange = useCallback(
    async (id: string, input: TripCashExchangeInput) => {
      const { error: updateError } = await supabase
        .from('trip_cash_exchanges')
        .update({ ...input, note: input.note?.trim() || null })
        .eq('id', id);
      if (updateError) throw updateError;
      await load();
    },
    [load]
  );

  const deleteCashExchange = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('trip_cash_exchanges').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await load();
    },
    [load]
  );

  return {
    trip,
    expenses,
    cashExchanges,
    loading,
    error,
    reload: load,
    addExpense,
    updateExpense,
    deleteExpense,
    addCashExchange,
    updateCashExchange,
    deleteCashExchange,
    setFriendShareRepaid,
    updateTrip,
    deleteTrip
  };
}
