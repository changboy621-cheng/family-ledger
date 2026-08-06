import { useCallback, useEffect, useRef, useState } from 'react';
import type { LedgerType, Transaction } from '../types';
import { supabase } from '../lib/supabase';
import { parseTransactions } from '../lib/schemas';
import { escapeLikePattern, mergeSearchResults, SEARCH_RESULT_LIMIT } from '../lib/search';
import { TRANSACTION_SELECT } from './useTransactions';
import { useAuthStore } from '../store/authStore';

export type SearchMode =
  | { kind: 'keyword'; keyword: string; categoryIds: string[] }
  | { kind: 'category'; categoryId: string };

interface SearchProfile {
  id: string;
  family_id: string;
}

function baseQuery(ledgerType: LedgerType, profile: SearchProfile) {
  const query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('ledger_type', ledgerType)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(SEARCH_RESULT_LIMIT);
  return ledgerType === 'family' ? query.eq('family_id', profile.family_id) : query.eq('owner_id', profile.id);
}

/**
 * 搜尋查詢（跨全部月份、無日期範圍）。keyword 模式查 note ilike；
 * 有符合名稱的分類時「另發」一個 category_id in 查詢，由呼叫端合併——
 * 避開 PostgREST .or() 對關鍵字特殊字元（逗號、括號）的跳脫地雷。
 */
export function buildSearchQueries(ledgerType: LedgerType, profile: SearchProfile, mode: SearchMode) {
  if (mode.kind === 'category') {
    return [baseQuery(ledgerType, profile).eq('category_id', mode.categoryId)];
  }
  const queries = [baseQuery(ledgerType, profile).ilike('note', `%${escapeLikePattern(mode.keyword)}%`)];
  if (mode.categoryIds.length > 0) {
    queries.push(baseQuery(ledgerType, profile).in('category_id', mode.categoryIds));
  }
  return queries;
}

/**
 * 關鍵字／分類搜尋 hook。mode 為 null 時清空結果不查詢。
 * 呼叫端須以 useMemo 穩定 mode 物件，避免每次 render 重查。
 */
export function useTransactionSearch(ledgerType: LedgerType, mode: SearchMode | null) {
  const profile = useAuthStore((state) => state.profile);
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // 請求序號：連續輸入造成查詢重疊時，只有最新請求能更新狀態（比照 useTransactionsCore）。
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!profile?.family_id || !mode) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    const responses = await Promise.all(
      buildSearchQueries(ledgerType, { id: profile.id, family_id: profile.family_id }, mode)
    );
    if (requestId !== requestIdRef.current) return;

    const failed = responses.find((response) => response.error);
    if (failed) {
      console.error('[useTransactionSearch] 搜尋失敗', failed.error);
      setError(true);
    } else {
      setResults(mergeSearchResults(responses.flatMap((response) => parseTransactions(response.data))));
      setError(false);
    }
    setLoading(false);
  }, [ledgerType, mode, profile?.family_id, profile?.id]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  return { results, loading, error, refetch: runSearch };
}
