import { useCallback, useEffect, useRef, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, RecurringTransaction, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { parseRecurringTransactions } from '../lib/schemas';
import { buildRecurringTransaction, dueMonths, resumedLastGeneratedMonth } from '../lib/recurring';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

export interface RecurringInput {
  ledger_type: LedgerType;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category_id: string;
  note?: string;
  payment_method?: PaymentMethod | null;
  day_of_month: number;
  /** 家庭帳本可指定歸屬成員；個人帳本一律本人。 */
  owner_id?: string;
}

function ruleOwnerId(input: RecurringInput, profileId: string) {
  return input.ledger_type === 'family' ? input.owner_id ?? profileId : profileId;
}

/**
 * 補記所有到期的固定收支，回傳這次新記入的筆數。
 * 以 (recurring_id, recurring_month) 唯一索引 + ignoreDuplicates 防重複：
 * 夫妻兩台裝置同時執行也只會記入一次。
 */
export async function generateDueRecurring(familyId: string, recorderId: string, today: Date = new Date()) {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('family_id', familyId)
    .eq('active', true);
  if (error) throw error;

  let created = 0;
  for (const rule of parseRecurringTransactions(data)) {
    const months = dueMonths(rule, today);
    if (months.length === 0) continue;

    const rows = months.map((month) => buildRecurringTransaction(rule, month, recorderId));
    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'recurring_id,recurring_month', ignoreDuplicates: true })
      .select('id');
    if (insertError) throw insertError;
    created += inserted?.length ?? 0;

    const { error: updateError } = await supabase
      .from('recurring_transactions')
      .update({ last_generated_month: months[months.length - 1] })
      .eq('id', rule.id);
    if (updateError) throw updateError;
  }

  return created;
}

/**
 * 掛在 AppShell：登入後、以及 App 從背景回到前景時補記到期的固定收支。
 * 有新記入時提示並通知各交易清單重抓。
 */
export function useRecurringGenerator() {
  const profile = useAuthStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const bumpDataVersion = useUIStore((state) => state.bumpDataVersion);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!profile?.family_id) return undefined;
    const familyId = profile.family_id;
    const profileId = profile.id;

    async function run() {
      if (runningRef.current || !navigator.onLine) return;
      runningRef.current = true;
      try {
        const created = await generateDueRecurring(familyId, profileId);
        if (created > 0) {
          showToast(`已自動記入 ${created} 筆固定收支`);
          bumpDataVersion();
        }
      } catch (error) {
        // 背景作業：不打擾使用者，下次開 App 會再補記。
        console.error('[useRecurringGenerator] 補記固定收支失敗', error);
      } finally {
        runningRef.current = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void run();
    }

    void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [profile?.family_id, profile?.id, showToast, bumpDataVersion]);
}

/** 設定頁用：讀取與新增／修改／暫停／刪除固定收支規則。 */
export function useRecurringRules() {
  const profile = useAuthStore((state) => state.profile);
  const bumpDataVersion = useUIStore((state) => state.bumpDataVersion);
  const [rules, setRules] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    const { data, error: fetchError } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('family_id', profile.family_id)
      .order('day_of_month', { ascending: true });

    if (fetchError) {
      console.error('[useRecurringRules] 讀取固定收支失敗', fetchError);
      setError(true);
    } else {
      setRules(parseRecurringTransactions(data));
      setError(false);
    }
    setLoading(false);
  }, [profile?.family_id]);

  useEffect(() => {
    void load();
  }, [load]);

  // 新增或恢復後立即補記（例如今天就是記入日），並讓清單重抓。
  const generateNow = useCallback(async () => {
    if (!profile?.family_id) return 0;
    const created = await generateDueRecurring(profile.family_id, profile.id);
    if (created > 0) bumpDataVersion();
    return created;
  }, [bumpDataVersion, profile?.family_id, profile?.id]);

  const createRule = useCallback(
    async (input: RecurringInput, startMonth: string) => {
      if (!profile?.family_id) throw new Error('尚未加入家庭，無法新增固定收支。');
      const { error: insertError } = await supabase.from('recurring_transactions').insert({
        ...input,
        note: input.note?.trim() || null,
        payment_method: input.payment_method ?? null,
        family_id: profile.family_id,
        owner_id: ruleOwnerId(input, profile.id),
        start_month: startMonth
      });
      if (insertError) throw insertError;
      const created = await generateNow();
      await load();
      return created;
    },
    [generateNow, load, profile?.family_id, profile?.id]
  );

  // 修改只影響之後的月份；已記入的交易不動。
  const updateRule = useCallback(
    async (id: string, input: RecurringInput) => {
      if (!profile) throw new Error('尚未登入。');
      const { error: updateError } = await supabase
        .from('recurring_transactions')
        .update({
          ...input,
          owner_id: ruleOwnerId(input, profile.id),
          note: input.note?.trim() || null,
          payment_method: input.payment_method ?? null
        })
        .eq('id', id);
      if (updateError) throw updateError;
      await load();
    },
    [load, profile]
  );

  // 暫停／恢復；恢復時暫停期間的月份不補記（見 resumedLastGeneratedMonth）。
  const setActive = useCallback(
    async (rule: RecurringTransaction, active: boolean) => {
      const patch: Partial<RecurringTransaction> = { active };
      const resumedMonth = active ? resumedLastGeneratedMonth(rule) : null;
      if (resumedMonth) patch.last_generated_month = resumedMonth;
      const { error: updateError } = await supabase.from('recurring_transactions').update(patch).eq('id', rule.id);
      if (updateError) throw updateError;
      const created = active ? await generateNow() : 0;
      await load();
      return created;
    },
    [generateNow, load]
  );

  // 刪除規則；已記入的交易保留（recurring_id 由資料庫改為 null）。
  const deleteRule = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('recurring_transactions').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await load();
    },
    [load]
  );

  return { rules, loading, error, reload: load, createRule, updateRule, setActive, deleteRule };
}
