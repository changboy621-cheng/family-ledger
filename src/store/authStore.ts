import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Family, UserProfile } from '../types';

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
  reset: () => set({ session: null, profile: null, family: null, loading: false })
}));
