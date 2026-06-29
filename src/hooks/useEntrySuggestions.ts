import { useEffect, useMemo, useState } from 'react';
import type { LedgerType, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { computeFrequentItems, computeRecentNotes } from '../lib/suggestions';
import { parseEntryRows } from '../lib/schemas';

// 抓最近交易，推算「常用項目快捷」與「備註歷史」供記帳表單快速輸入。
export function useEntrySuggestions(ledgerType: LedgerType, type: TransactionType) {
  const profile = useAuthStore((state) => state.profile);
  const [rows, setRows] = useState<ReturnType<typeof parseEntryRows>>([]);

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
      if (!active) return;
      // 建議是便利性功能，失敗不需打斷使用者；但不再靜默吞錯，記錄以利除錯。
      if (error) {
        console.error('[useEntrySuggestions] 讀取建議資料失敗', error);
        return;
      }
      setRows(parseEntryRows(data));
    }

    void load();
    return () => {
      active = false;
    };
  }, [ledgerType, type, profile?.family_id, profile?.id]);

  // rows 變動才重算；否則表單每次輸入（rerender）都會重掃最多 200 列兩次。
  const frequentItems = useMemo(() => computeFrequentItems(rows), [rows]);
  const noteHistory = useMemo(() => computeRecentNotes(rows), [rows]);

  return { frequentItems, noteHistory };
}
