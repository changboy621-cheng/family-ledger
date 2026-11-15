import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Currency } from '../types';
import { supabase } from '../lib/supabase';
import { computeSettlement, defaultSplitSince, type PaidTotal, type SettlementRecord } from '../lib/settlement';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useFamilyMembers } from './useFamilyMembers';

function isMissingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ['42P01', '42883', '42703', 'PGRST202', 'PGRST205'].includes(error.code ?? '') || /does not exist|could not find/i.test(error.message ?? '');
}

/** 家人分帳：家庭支出各付一半，扣掉共同帳戶付的與已結清的，算出誰該補誰。 */
export function useSettlement() {
  const profile = useAuthStore((state) => state.profile);
  const family = useAuthStore((state) => state.family);
  const setFamily = useAuthStore((state) => state.setFamily);
  const dataVersion = useUIStore((state) => state.dataVersion);
  const { members } = useFamilyMembers();
  const since = family?.split_since ?? defaultSplitSince();
  const [paid, setPaid] = useState<PaidTotal[]>([]);
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    const [paidRes, recordRes] = await Promise.all([
      supabase.rpc('family_paid_totals', { since }),
      supabase
        .from('family_settlements')
        .select('*')
        .eq('family_id', profile.family_id)
        .gte('settled_on', since)
        .order('settled_on', { ascending: false })
        .order('created_at', { ascending: false })
    ]);
    const error = paidRes.error ?? recordRes.error;
    if (error) {
      if (isMissingSchema(error)) setStatus('unavailable');
      else {
        console.error('分帳資料載入失敗', error);
        setStatus('error');
      }
      return;
    }
    setPaid(((paidRes.data ?? []) as PaidTotal[]).map((row) => ({ ...row, total: Number(row.total) })));
    setRecords(((recordRes.data ?? []) as SettlementRecord[]).map((row) => ({ ...row, amount: Number(row.amount) })));
    setStatus('ready');
  }, [profile?.family_id, since]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  const memberIds = useMemo(() => members.map((member) => member.id), [members]);
  const currencies = useMemo<Currency[]>(
    () => (paid.some((row) => row.currency === 'USD') || records.some((row) => row.currency === 'USD') ? ['TWD', 'USD'] : ['TWD']),
    [paid, records]
  );
  const plans = useMemo(
    () => currencies.map((currency) => ({ currency, plan: computeSettlement(memberIds, paid, records, currency) })),
    [currencies, memberIds, paid, records]
  );

  const settle = useCallback(
    async (input: { from: string; to: string; amount: number; currency: Currency; settledOn: string; note?: string }) => {
      if (!profile?.family_id) throw new Error('尚未加入家庭。');
      const { error } = await supabase.from('family_settlements').insert({
        family_id: profile.family_id,
        from_member: input.from,
        to_member: input.to,
        amount: input.amount,
        currency: input.currency,
        settled_on: input.settledOn,
        note: input.note?.trim() || null,
        created_by: profile.id
      });
      if (error) throw error;
      await load();
    },
    [load, profile]
  );

  const removeRecord = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('family_settlements').delete().eq('id', id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  const updateSince = useCallback(
    async (date: string) => {
      if (!profile?.family_id) return;
      const { error } = await supabase.from('families').update({ split_since: date }).eq('id', profile.family_id);
      if (error) throw error;
      const current = useAuthStore.getState().family;
      if (current) setFamily({ ...current, split_since: date });
    },
    [profile?.family_id, setFamily]
  );

  return { since, plans, records, members, status, reload: load, settle, removeRecord, updateSince };
}
