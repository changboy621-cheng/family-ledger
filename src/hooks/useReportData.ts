import { useCallback, useEffect, useRef, useState } from 'react';
import type { LedgerType, Transaction } from '../types';
import { parseTransactions } from '../lib/schemas';
import { useAuthStore } from '../store/authStore';
import { fetchTransactions } from './useTransactions';

const PAGE = 1000; // Supabase 單次查詢預設最多回 1000 列，超過要分頁。

async function fetchAll(ledgerType: LedgerType, profile: { id: string; family_id: string }, from: string, to: string) {
  const rows: Transaction[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await fetchTransactions({ ledgerType, profile, from, to }).range(offset, offset + PAGE - 1);
    if (error) throw error;
    const page = parseTransactions(data);
    rows.push(...page);
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/** 報表資料：某年度與前一年度（月對月要比去年同月）的家庭帳＋我的個人帳。 */
export function useReportData(year: number) {
  const profile = useAuthStore((state) => state.profile);
  const [family, setFamily] = useState<Transaction[]>([]);
  const [personal, setPersonal] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!profile?.family_id) return;
    const request = (requestRef.current += 1);
    setLoading(true);
    setError(false);
    try {
      const from = `${year - 1}-01-01`;
      const to = `${year}-12-31`;
      const [familyRows, personalRows] = await Promise.all([
        fetchAll('family', profile, from, to),
        fetchAll('personal', profile, from, to)
      ]);
      if (request !== requestRef.current) return;
      setFamily(familyRows);
      setPersonal(personalRows);
    } catch (loadError) {
      console.error('報表資料載入失敗', loadError);
      if (request === requestRef.current) setError(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [profile, year]);

  useEffect(() => {
    void load();
  }, [load]);

  return { family, personal, loading, error, reload: load };
}
