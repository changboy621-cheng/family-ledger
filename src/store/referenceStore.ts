import { create } from 'zustand';
import type { Category, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { parseCategories, parseUserProfiles } from '../lib/schemas';

// 慢變動的參照資料（家庭成員、分類）集中快取，避免每個元件掛載各自重抓。
// 以 family_id 為 key 載入一次；外部異動（分類匯入、改名）需呼叫對應 reload* 失效。
interface ReferenceState {
  members: UserProfile[];
  categories: Category[];
  membersLoading: boolean;
  categoriesLoading: boolean;
  membersError: boolean;
  categoriesError: boolean;
  loadedMembersFamilyId: string | null;
  loadedCategoriesFamilyId: string | null;
  ensureMembers: (familyId: string) => Promise<void> | void;
  ensureCategories: (familyId: string) => Promise<void> | void;
  reloadMembers: (familyId: string) => Promise<void>;
  reloadCategories: (familyId: string) => Promise<void>;
  clear: () => void;
}

const INITIAL = {
  members: [] as UserProfile[],
  categories: [] as Category[],
  membersLoading: false,
  categoriesLoading: false,
  membersError: false,
  categoriesError: false,
  loadedMembersFamilyId: null as string | null,
  loadedCategoriesFamilyId: null as string | null
};

/**
 * 衍生「是否仍在載入」：store 的 loading 旗標初始為 false，若直接採用，
 * 會在 effect 尚未觸發 ensure* 之前就回報「已載入但空集合」，造成 QuickAdd 等
 * 提早判定「找不到類別」。規則：
 * - 尚未加入家庭：視為載入中（沿用原行為）。
 * - 上一次嘗試失敗（error）：回報「非載入中」，讓畫面顯示錯誤/空集合而非無限轉圈。
 * - 否則：實際載入中、或尚未為「當前家庭」載入完成，皆視為載入中。
 */
export function deriveReferenceLoading(
  loading: boolean,
  loadedFamilyId: string | null,
  familyId: string | undefined,
  error = false
): boolean {
  if (!familyId) return true;
  if (error) return false;
  return loading || loadedFamilyId !== familyId;
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  ...INITIAL,

  ensureMembers: (familyId) => {
    const state = get();
    if (state.loadedMembersFamilyId === familyId && !state.membersError) return;
    // 換家庭（cache miss）或重試前先清掉舊成員，避免短暫露出他家資料（表單會直接讀此陣列）。
    set({ members: [] });
    return get().reloadMembers(familyId);
  },

  ensureCategories: (familyId) => {
    const state = get();
    if (state.loadedCategoriesFamilyId === familyId && !state.categoriesError) return;
    set({ categories: [] });
    return get().reloadCategories(familyId);
  },

  reloadMembers: async (familyId) => {
    // 同步設定目標家庭，使並發呼叫者命中 cache-hit 分支、只觸發一次查詢。
    set({ loadedMembersFamilyId: familyId, membersLoading: true, membersError: false });
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true });

    if (get().loadedMembersFamilyId !== familyId) return; // 已被後續換家庭取代
    if (error) {
      // 失敗：loadedFamilyId 設回 null 以保留可重試；error 旗標讓畫面不會卡在載入中。
      set({ loadedMembersFamilyId: null, membersLoading: false, membersError: true });
      return;
    }
    set({ members: parseUserProfiles(data), membersLoading: false });
  },

  reloadCategories: async (familyId) => {
    set({ loadedCategoriesFamilyId: familyId, categoriesLoading: true, categoriesError: false });
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`family_id.is.null,family_id.eq.${familyId}`)
      .order('sort_order', { ascending: true });

    if (get().loadedCategoriesFamilyId !== familyId) return;
    if (error) {
      set({ loadedCategoriesFamilyId: null, categoriesLoading: false, categoriesError: true });
      return;
    }
    set({ categories: parseCategories(data), categoriesLoading: false });
  },

  clear: () => set({ ...INITIAL })
}));
