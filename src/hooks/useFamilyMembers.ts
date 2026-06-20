import { useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// 取得同一個家庭的所有成員，用於「幫誰記帳」的選單。
export function useFamilyMembers() {
  const profile = useAuthStore((state) => state.profile);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('family_id', profile?.family_id ?? '')
        .order('created_at', { ascending: true });

      if (active && !error) setMembers(data ?? []);
      if (active) setLoading(false);
    }

    if (profile?.family_id) void loadMembers();
    else setLoading(false);

    return () => {
      active = false;
    };
  }, [profile?.family_id]);

  return { members, loading };
}
