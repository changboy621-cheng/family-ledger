import { useCallback, useEffect, useMemo } from 'react';
import type { Category, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { deriveReferenceLoading, useReferenceStore } from '../store/referenceStore';

export function useCategories(type: TransactionType) {
  const profile = useAuthStore((state) => state.profile);
  const allCategories = useReferenceStore((state) => state.categories);
  const storeLoading = useReferenceStore((state) => state.categoriesLoading);
  const loadedFamilyId = useReferenceStore((state) => state.loadedCategoriesFamilyId);
  const error = useReferenceStore((state) => state.categoriesError);
  const ensureCategories = useReferenceStore((state) => state.ensureCategories);
  const reloadCategories = useReferenceStore((state) => state.reloadCategories);

  useEffect(() => {
    if (profile?.family_id) void ensureCategories(profile.family_id);
  }, [profile?.family_id, ensureCategories]);

  // 尚未為當前家庭載入完成前一律視為載入中，避免 QuickAdd 提早判定「找不到類別」；
  // 但載入失敗時改回「非載入中」，避免卡在無限轉圈（沿用原本失敗即顯示空集合的行為）。
  const loading = deriveReferenceLoading(storeLoading, loadedFamilyId, profile?.family_id, error);

  // 快取的分類含全部類型；依目前 type 過濾並排序（取代原本的 per-type 查詢）。
  const categories = useMemo(
    () =>
      allCategories
        .filter((category) => category.type === type)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [allCategories, type]
  );

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
      await reloadCategories(profile.family_id);
      return data as Category;
    },
    [categories, reloadCategories, profile?.family_id, type]
  );

  // 更新自訂類別的名稱與圖示（系統內建類別因 RLS 無法更新）。
  const updateCategory = useCallback(
    async (id: string, name: string, icon: string): Promise<Category> => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('請輸入類別名稱。');

      const { data, error } = await supabase
        .from('categories')
        .update({ name: trimmed, icon })
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) throw error ?? new Error('更新類別失敗，請稍後再試。');
      if (profile?.family_id) await reloadCategories(profile.family_id);
      return data as Category;
    },
    [reloadCategories, profile?.family_id]
  );

  const reload = useCallback(async () => {
    if (profile?.family_id) await reloadCategories(profile.family_id);
  }, [reloadCategories, profile?.family_id]);

  return { categories, loading, createCategory, updateCategory, reload };
}
