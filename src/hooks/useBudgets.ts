import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Budget, Currency, LedgerType } from '../types';
import { supabase } from '../lib/supabase';
import { parseBudgets } from '../lib/schemas';
import { resolveEffectiveBudgets } from '../lib/budget';
import { useAuthStore } from '../store/authStore';

export interface BudgetInput {
  ledgerType: LedgerType;
  /** null = 總預算 */
  categoryId: string | null;
  currency: Currency;
  /** 0 = 自此月起取消 */
  amount: number;
}

interface WriteBudgetParams extends BudgetInput {
  familyId: string;
  profileId: string;
  yearMonth: string;
}

/**
 * 寫入「自 yearMonth 起」的預算。同月已有同一格就更新，否則新增。
 * 不用 upsert：owner_id / category_id 可為 null，而 Postgres unique 視 null 為相異，onConflict 對不上。
 */
export async function writeBudget({ familyId, profileId, yearMonth, ledgerType, categoryId, currency, amount }: WriteBudgetParams) {
  const ownerId = ledgerType === 'personal' ? profileId : null;

  let query = supabase
    .from('budgets')
    .select('id')
    .eq('family_id', familyId)
    .eq('ledger_type', ledgerType)
    .eq('year_month', yearMonth)
    .eq('currency', currency);
  query = ownerId ? query.eq('owner_id', ownerId) : query.is('owner_id', null);
  query = categoryId ? query.eq('category_id', categoryId) : query.is('category_id', null);

  const { data: existing, error: findError } = await query.limit(1);
  if (findError) throw findError;

  const existingId = (existing as { id: string }[] | null)?.[0]?.id;
  const { error } = existingId
    ? await supabase.from('budgets').update({ amount }).eq('id', existingId)
    : await supabase.from('budgets').insert({
        family_id: familyId,
        owner_id: ownerId,
        ledger_type: ledgerType,
        category_id: categoryId,
        year_month: yearMonth,
        amount,
        currency
      });
  if (error) throw error;
}

/**
 * 讀取指定月份生效的預算（家庭＋本人個人；RLS 已擋掉他人個人預算），並提供寫入。
 * 預算變動少，掛載時讀一次、寫入後重讀即可，不另開 realtime channel。
 */
export function useBudgets(yearMonth: string) {
  const profile = useAuthStore((state) => state.profile);
  const [rows, setRows] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    const { data, error: fetchError } = await supabase
      .from('budgets')
      .select('*')
      .eq('family_id', profile.family_id)
      .lte('year_month', yearMonth);

    if (fetchError) {
      console.error('[useBudgets] 讀取預算失敗', fetchError);
      setError(true);
    } else {
      setRows(parseBudgets(data));
      setError(false);
    }
    setLoading(false);
  }, [profile?.family_id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const budgets = useMemo(() => resolveEffectiveBudgets(rows, yearMonth), [rows, yearMonth]);

  const saveBudget = useCallback(
    async (input: BudgetInput) => {
      if (!profile?.family_id) throw new Error('尚未加入家庭，無法設定預算。');
      await writeBudget({ ...input, familyId: profile.family_id, profileId: profile.id, yearMonth });
      await load();
    },
    [load, profile?.family_id, profile?.id, yearMonth]
  );

  return { budgets, loading, error, reload: load, saveBudget };
}
