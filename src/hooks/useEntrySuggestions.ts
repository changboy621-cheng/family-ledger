import { useEffect, useState } from 'react';
import type { LedgerType, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { computeFrequentItems, computeRecentNotes, type EntryRow } from '../lib/suggestions';

// 抓最近交易，推算「常用項目快捷」與「備註歷史」供記帳表單快速輸入。
export function useEntrySuggestions(ledgerType: LedgerType, type: TransactionType) {
  const profile = useAuthStore((state) => state.profile);
  const [rows, setRows] = useState<EntryRow[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!profile?.family_id) {
        setRows([]);
        return;
      }

      let query = supabase
        .from('transactions')
        .select('category_id, note, transaction_date, category:categories(name, icon)')
        .eq('ledger_type', ledgerType)
        .eq('type', type)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      query = ledgerType === 'family' ? query.eq('family_id', profile.family_id) : query.eq('owner_id', profile.id);

      const { data, error } = await query;
      if (active && !error) setRows((data ?? []) as unknown as EntryRow[]);
    }

    void load();
    return () => {
      active = false;
    };
  }, [ledgerType, type, profile?.family_id, profile?.id]);

  return {
    frequentItems: computeFrequentItems(rows),
    noteHistory: computeRecentNotes(rows)
  };
}
