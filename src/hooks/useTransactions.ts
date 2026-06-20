import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Currency, LedgerType, PaymentMethod, Transaction, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
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

export function useTransactions(ledgerType: LedgerType, yearMonth: string, currencyFilter: Currency | 'all' = 'all') {
  const profile = useAuthStore((state) => state.profile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!profile?.family_id) return;

    const range = monthRange(yearMonth);
    setLoading(true);

    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), owner:user_profiles(*)')
      .eq('ledger_type', ledgerType)
      .gte('transaction_date', range.from)
      .lte('transaction_date', range.to)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (ledgerType === 'family') {
      query = query.eq('family_id', profile.family_id);
    } else {
      query = query.eq('owner_id', profile.id);
    }

    const { data, error } = await query;
    if (!error) setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
  }, [ledgerType, profile?.family_id, profile?.id, yearMonth]);

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
        owner_id: input.ledger_type === 'family' ? owner_id ?? profile.id : profile.id,
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
          ...(input.ledger_type === 'family' && input.owner_id ? { owner_id: input.owner_id } : {})
        })
        .eq('id', id);

      if (error) throw error;
      await loadTransactions();
    },
    [loadTransactions]
  );

  const visibleTransactions = useMemo(() => {
    if (currencyFilter === 'all') return transactions;
    return transactions.filter((transaction) => transaction.currency === currencyFilter);
  }, [currencyFilter, transactions]);

  const groupedTransactions = useMemo(() => {
    return visibleTransactions.reduce<Record<string, Transaction[]>>((groups, transaction) => {
      groups[transaction.transaction_date] ??= [];
      groups[transaction.transaction_date].push(transaction);
      return groups;
    }, {});
  }, [visibleTransactions]);

  return {
    transactions,
    groupedTransactions,
    loading,
    loadTransactions,
    createTransaction,
    deleteTransaction,
    updateTransaction
  };
}

export function useAnalysisTransactions(ledgerType: LedgerType, yearMonth: string) {
  const profile = useAuthStore((state) => state.profile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!profile?.family_id) return;

    const range = rollingMonthRange(yearMonth, 5);
    setLoading(true);

    let query = supabase
      .from('transactions')
      .select('*, category:categories(*), owner:user_profiles(*)')
      .eq('ledger_type', ledgerType)
      .gte('transaction_date', range.from)
      .lte('transaction_date', range.to)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (ledgerType === 'family') {
      query = query.eq('family_id', profile.family_id);
    } else {
      query = query.eq('owner_id', profile.id);
    }

    const { data, error } = await query;
    if (!error) setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
  }, [ledgerType, profile?.family_id, profile?.id, yearMonth]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useRealtimeSync(ledgerType === 'family' ? profile?.family_id : undefined, loadTransactions);

  return { transactions, loading, loadTransactions };
}
