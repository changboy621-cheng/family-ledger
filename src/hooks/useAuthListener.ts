import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { loadProfileIntoStore } from './loadProfileIntoStore';

// 只在 App 根部掛載一次：負責 auth session 訂閱與 profile 載入，
// 取代原本散落在每個 useAuth() 呼叫點的重複訂閱。
export function useAuthListener(): void {
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user.id) {
        await loadProfileIntoStore(data.session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) {
        void loadProfileIntoStore(nextSession.user.id);
      } else {
        reset();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [reset, setLoading, setSession]);
}
