import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Family, UserProfile } from '../types';
import { useReferenceStore } from './referenceStore';

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  family: Family | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setFamily: (family: Family | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  family: null,
  loading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setFamily: (family) => set({ family }),
  setLoading: (loading) => set({ loading }),
  reset: () => {
    // 登出/換帳號時一併清掉共用參照快取（成員、分類），
    // 避免同一個 SPA session 內下一位使用者短暫讀到上一位家庭的資料。
    set({ session: null, profile: null, family: null, loading: false });
    useReferenceStore.getState().clear();
  }
}));
