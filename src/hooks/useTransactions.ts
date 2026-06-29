import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, Transaction, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { parseTransactions } from '../lib/schemas';
import { TREND_MONTHS_BACK } from '../lib/constants';
import { monthRange, rollingMonthRange } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { useRealtimeSync } from './useRealtimeSync';

export interface TransactionInput {
  ledger_type: LedgerType;
  type: TransactionType;
  amount: number;
  currency: Currency;
  category_id: string;
  transaction_date: string;
  note?: string;
  payment_method?: PaymentMethod | null;
  /** 這筆帳歸屬的成員；未指定時即記帳人本人。家庭帳本可代其他成員記錄。 */
  owner_id?: string;
}

export interface TransactionUpdateInput extends TransactionInput {
  id: string;
}

const TRANSACTION_SELECT = '*, category:categories(*), owner:user_profiles(*)';

interface FetchTransactionsParams {
  ledgerType: LedgerType;
  profile: { id: string; family_id: string };
  from: string;
  to: string;
}

/**
 * 交易查詢的單一來源：family 以 family_id、personal 以 owner_id 過濾，並套用日期範圍。
 * 由 list / analysis / 匯出等所有讀取路徑共用，避免 select/filter 邏輯重複漂移。
 */
export function fetchTransactions({ ledgerType, profile, from, to }: FetchTransactionsParams) {
  let query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('ledger_type', ledgerType)
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (ledgerType === 'family') {
    query = query.eq('family_id', profile.family_id);
  } else {
    query = query.eq('owner_id', profile.id);
  }

  return query;
}

/**
 * 新增交易時的 owner_id：家庭帳本可代記他人（未指定則記帳人本人），個人帳本一律本人。
 */
export function resolveInsertOwnerId(
  ledgerType: LedgerType,
  inputOwnerId: string | undefined,
  profileId: string
): string {
  return ledgerType === 'family' ? inputOwnerId ?? profileId : profileId;
}

/**
 * 更新交易時的 owner_id patch：僅在家庭帳本且有指定 owner 時才改 owner_id；
 * 個人帳本不動 owner（避免把別人個人帳改成自己）。
 */
export function resolveUpdateOwnerPatch(
  ledgerType: LedgerType,
  inputOwnerId: string | undefined
): { owner_id?: string } {
  return ledgerType === 'family' && inputOwnerId ? { owner_id: inputOwnerId } : {};
}

/** 從較大的交易集合（如近 6 個月）挑出指定月份（YYYY-MM），維持原順序。 */
export function filterTransactionsByMonth(transactions: Transaction[], yearMonth: string): Transaction[] {
  const { from, to } = monthRange(yearMonth);
  return transactions.filter(
    (transaction) => transaction.transaction_date >= from && transaction.transaction_date <= to
  );
}

interface DateRange {
  from: string;
  to: string;
}

/**
 * 交易讀取 + 即時同步 + 異動操作的核心 hook，依傳入的日期範圍抓取一次。
 * list（當月）與 analysis（近 6 月）只是範圍不同，共用此核心，確保單一查詢與單一 realtime channel。
 */
function useTransactionsCore(ledgerType: LedgerType, range: DateRange) {
  const profile = useAuthStore((state) => state.profile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!profile?.family_id) return;

    setLoading(true);
    const { data, error } = await fetchTransactions({
      ledgerType,
      profile: { id: profile.id, family_id: profile.family_id },
      from: range.from,
      to: range.to
    });
    if (!error) setTransactions(parseTransactions(data));
    setLoading(false);
  }, [ledgerType, profile?.family_id, profile?.id, range.from, range.to]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useRealtimeSync(ledgerType === 'family' ? profile?.family_id : undefined, loadTransactions);

  const createTransaction = useCallback(
    async (input: TransactionInput) => {
      if (!profile?.family_id) throw new Error('尚未加入家庭，無法新增交易。');

      const { owner_id, ...rest } = input;
      const { error } = await supabase.from('transactions').insert({
        ...rest,
        family_id: profile.family_id,
        owner_id: resolveInsertOwnerId(input.ledger_type, owner_id, profile.id),
        recorded_by: profile.id,
        note: input.note?.trim() || null,
        payment_method: input.payment_method ?? null
      });

      if (error) throw error;
      await loadTransactions();
    },
    [loadTransactions, profile?.family_id, profile?.id]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', transactionId);

      if (error) throw error;
      await loadTransactions();
    },
    [loadTransactions]
  );

  const updateTransaction = useCallback(
    async ({ id, ...input }: TransactionUpdateInput) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          ledger_type: input.ledger_type,
          type: input.type,
          amount: input.amount,
          currency: input.currency,
          category_id: input.category_id,
          transaction_date: input.transaction_date,
          note: input.note?.trim() || null,
          payment_method: input.payment_method ?? null,
          ...resolveUpdateOwnerPatch(input.ledger_type, input.owner_id)
        })
        .eq('id', id);

      if (error) throw error;
      await loadTransactions();
    },
    [loadTransactions]
  );

  return { transactions, loading, loadTransactions, createTransaction, deleteTransaction, updateTransaction };
}

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce<Record<string, Transaction[]>>((groups, transaction) => {
    groups[transaction.transaction_date] ??= [];
    groups[transaction.transaction_date].push(transaction);
    return groups;
  }, {});
}

/** 當月交易（list 用）。Dashboard 等只需單月資料的畫面使用。 */
export function useTransactions(ledgerType: LedgerType, yearMonth: string, currencyFilter: Currency | 'all' = 'all') {
  const range = useMemo(() => monthRange(yearMonth), [yearMonth]);
  const core = useTransactionsCore(ledgerType, range);

  const visibleTransactions = useMemo(() => {
    if (currencyFilter === 'all') return core.transactions;
    return core.transactions.filter((transaction) => transaction.currency === currencyFilter);
  }, [currencyFilter, core.transactions]);

  const groupedTransactions = useMemo(() => groupByDate(visibleTransactions), [visibleTransactions]);

  return { ...core, groupedTransactions };
}

/**
 * 帳本頁（list + 近 6 月分析）的單一資料來源：只抓近 6 個月一次、只開一個 realtime channel。
 * `transactions` 提供給 analysis；當月清單由 client 端衍生，異動後只需重抓這一份。
 */
export function useLedgerTransactions(
  ledgerType: LedgerType,
  yearMonth: string,
  currencyFilter: Currency | 'all' = 'all'
) {
  const range = useMemo(() => rollingMonthRange(yearMonth, TREND_MONTHS_BACK), [yearMonth]);
  const core = useTransactionsCore(ledgerType, range);

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(core.transactions, yearMonth),
    [core.transactions, yearMonth]
  );

  const visibleTransactions = useMemo(() => {
    if (currencyFilter === 'all') return monthTransactions;
    return monthTransactions.filter((transaction) => transaction.currency === currencyFilter);
  }, [currencyFilter, monthTransactions]);

  const groupedTransactions = useMemo(() => groupByDate(visibleTransactions), [visibleTransactions]);

  return { ...core, monthTransactions, groupedTransactions };
}
