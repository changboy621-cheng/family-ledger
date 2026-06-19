import { useEffect, useState } from 'react';
import type { Category, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export function useCategories(type: TransactionType) {
  const profile = useAuthStore((state) => state.profile);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('type', type)
        .or(`family_id.is.null,family_id.eq.${profile?.family_id}`)
        .order('sort_order', { ascending: true });

      if (!error) setCategories(data ?? []);
      setLoading(false);
    }

    if (profile?.family_id) void loadCategories();
  }, [profile?.family_id, type]);

  return { categories, loading };
}
