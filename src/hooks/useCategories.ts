import { useCallback, useEffect, useState } from 'react';
import type { Category, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export function useCategories(type: TransactionType) {
  const profile = useAuthStore((state) => state.profile);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!profile?.family_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .or(`family_id.is.null,family_id.eq.${profile.family_id}`)
      .order('sort_order', { ascending: true });

    if (!error) setCategories(data ?? []);
    setLoading(false);
  }, [profile?.family_id, type]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  // 新增家庭自訂類別，回傳建立後的類別（供表單立即選用）。
  const createCategory = useCallback(
    async (name: string, icon: string): Promise<Category> => {
      if (!profile?.family_id) throw new Error('尚未加入家庭，無法新增類別。');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('請輸入類別名稱。');

      const maxSort = categories.reduce((max, category) => Math.max(max, category.sort_order ?? 0), 0);
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: trimmed,
          icon,
          type,
          family_id: profile.family_id,
          is_shared: true,
          sort_order: maxSort + 10
        })
        .select('*')
        .single();

      if (error || !data) throw error ?? new Error('新增類別失敗，請稍後再試。');
      await loadCategories();
      return data as Category;
    },
    [categories, loadCategories, profile?.family_id, type]
  );

  return { categories, loading, createCategory, reload: loadCategories };
}
