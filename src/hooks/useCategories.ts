import { useCallback, useEffect, useMemo } from 'react';
import type { Category, TransactionType } from '../types';
import { supabase } from '../lib/supabase';
import { sortByCategoryOrder } from '../lib/categoryOrder';
import { useAuthStore } from '../store/authStore';
import { deriveReferenceLoading, useReferenceStore } from '../store/referenceStore';

// 刪除類別前的守門：若已有帳目（交易）使用此類別，擋下並丟出友善錯誤，
// 避免破壞既有帳目的分類。查詢出錯時往外拋，不當作「可刪除」。
export async function ensureCategoryDeletable(categoryId: string): Promise<void> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('category_id', categoryId)
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) {
    throw new Error('此類別已有帳目使用，無法刪除');
  }
}

export function useCategories(type: TransactionType) {
  const profile = useAuthStore((state) => state.profile);
  const categoryOrder = useAuthStore((state) => state.family?.category_order);
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

  // 快取的分類含全部類型；依目前 type 過濾，再套用家庭自訂順序（未列到者退回 sort_order）。
  const categories = useMemo(
    () =>
      sortByCategoryOrder(
        allCategories.filter((category) => category.type === type),
        categoryOrder ?? []
      ),
    [allCategories, type, categoryOrder]
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

  // 更新類別的名稱與圖示（migration 後內建類別已轉為家庭自有，同樣可更新）。
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

  // 刪除類別（含內建：migration 後內建已轉為家庭自有，RLS 允許刪除）。
  // 先確認沒有帳目使用，再刪除並失效快取。
  const deleteCategory = useCallback(
    async (id: string): Promise<void> => {
      await ensureCategoryDeletable(id);

      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      if (profile?.family_id) await reloadCategories(profile.family_id);
    },
    [reloadCategories, profile?.family_id]
  );

  const reload = useCallback(async () => {
    if (profile?.family_id) await reloadCategories(profile.family_id);
  }, [reloadCategories, profile?.family_id]);

  return { categories, loading, createCategory, updateCategory, deleteCategory, reload };
}
