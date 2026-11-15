import { create } from 'zustand';
import type { Account, AccountMonthlyFlow, AccountTransfer } from '../types';
import { supabase } from '../lib/supabase';
import { parseAccountFlows, parseAccounts, parseAccountTransfers } from '../lib/schemas';

/**
 * 帳戶（資產管理）的共用快取：記帳表單、資產頁、首頁都讀同一份。
 * 資料庫還沒跑 015 migration 時，status 為 'unavailable'，畫面據此提示而非報錯。
 */
interface AccountState {
  accounts: Account[];
  flows: AccountMonthlyFlow[];
  transfers: AccountTransfer[];
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  loadedFamilyId: string | null;
  ensure: (familyId: string) => void;
  reload: (familyId: string) => Promise<void>;
  clear: () => void;
}

/** 資料表或函式不存在（migration 尚未執行）。 */
function isMissingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '') || /does not exist|could not find/i.test(error.message ?? '');
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  flows: [],
  transfers: [],
  status: 'idle',
  loadedFamilyId: null,

  ensure: (familyId) => {
    const state = get();
    if (state.loadedFamilyId === familyId && state.status !== 'error') return;
    if (state.status === 'loading') return;
    void get().reload(familyId);
  },

  reload: async (familyId) => {
    set((state) => ({ status: state.loadedFamilyId === familyId && state.status === 'ready' ? 'ready' : 'loading' }));
    const [accountsRes, flowsRes, transfersRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('family_id', familyId).order('sort_order').order('created_at'),
      supabase.rpc('account_monthly_flows'),
      supabase.from('account_transfers').select('*').eq('family_id', familyId).order('transfer_date', { ascending: false }).limit(50)
    ]);
    const firstError = accountsRes.error ?? flowsRes.error ?? transfersRes.error;
    if (firstError) {
      if (isMissingSchema(firstError)) {
        set({ accounts: [], flows: [], transfers: [], status: 'unavailable', loadedFamilyId: familyId });
      } else {
        console.error('帳戶載入失敗', firstError);
        set({ status: 'error', loadedFamilyId: familyId });
      }
      return;
    }
    set({
      accounts: parseAccounts(accountsRes.data),
      flows: parseAccountFlows(flowsRes.data),
      transfers: parseAccountTransfers(transfersRes.data),
      status: 'ready',
      loadedFamilyId: familyId
    });
  },

  clear: () => set({ accounts: [], flows: [], transfers: [], status: 'idle', loadedFamilyId: null })
}));
