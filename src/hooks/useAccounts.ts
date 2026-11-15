import { useCallback, useEffect, useMemo } from 'react';
import type { Account, AccountKind, Currency } from '../types';
import { supabase } from '../lib/supabase';
import { computeBalances, netWorthByCurrency } from '../lib/accounts';
import { useAuthStore } from '../store/authStore';
import { useAccountStore } from '../store/accountStore';
import { useUIStore } from '../store/uiStore';

export interface AccountInput {
  name: string;
  kind: AccountKind;
  currency: Currency;
  opening_balance: number;
  /** true = 家庭共同帳戶；false = 我的個人帳戶。 */
  shared: boolean;
}

export interface TransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  note?: string;
}

export function useAccounts() {
  const profile = useAuthStore((state) => state.profile);
  const familyId = profile?.family_id;
  const { accounts, flows, transfers, status, ensure, reload } = useAccountStore();
  const dataVersion = useUIStore((state) => state.dataVersion);

  useEffect(() => {
    if (familyId) ensure(familyId);
  }, [familyId, ensure]);

  // 記帳、匯入等其他地方改了交易（會影響餘額）時重抓。
  useEffect(() => {
    if (familyId && dataVersion > 0) void reload(familyId);
  }, [dataVersion, familyId, reload]);

  const balances = useMemo(() => computeBalances(accounts, flows), [accounts, flows]);
  const netWorth = useMemo(() => netWorthByCurrency(accounts, balances), [accounts, balances]);
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.archived), [accounts]);

  const refresh = useCallback(async () => {
    if (familyId) await reload(familyId);
  }, [familyId, reload]);

  const createAccount = useCallback(
    async (input: AccountInput) => {
      if (!familyId || !profile) throw new Error('尚未加入家庭。');
      const { error } = await supabase.from('accounts').insert({
        family_id: familyId,
        owner_id: input.shared ? null : profile.id,
        name: input.name.trim(),
        kind: input.kind,
        currency: input.currency,
        opening_balance: input.opening_balance,
        sort_order: accounts.length
      });
      if (error) throw error;
      await refresh();
    },
    [accounts.length, familyId, profile, refresh]
  );

  const updateAccount = useCallback(
    async (id: string, patch: Partial<Pick<Account, 'name' | 'kind' | 'opening_balance' | 'archived'>>) => {
      const { error } = await supabase.from('accounts').update(patch).eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const createTransfer = useCallback(
    async (input: TransferInput) => {
      if (!familyId || !profile) throw new Error('尚未加入家庭。');
      const { error } = await supabase.from('account_transfers').insert({
        ...input,
        note: input.note?.trim() || null,
        family_id: familyId,
        created_by: profile.id
      });
      if (error) throw error;
      await refresh();
    },
    [familyId, profile, refresh]
  );

  const deleteTransfer = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('account_transfers').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  return {
    accounts,
    activeAccounts,
    flows,
    transfers,
    balances,
    netWorth,
    status,
    refresh,
    createAccount,
    updateAccount,
    deleteAccount,
    createTransfer,
    deleteTransfer
  };
}
