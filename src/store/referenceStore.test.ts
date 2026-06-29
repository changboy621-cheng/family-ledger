import { describe, expect, it, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { deriveReferenceLoading, useReferenceStore } from './referenceStore';

// 可鏈式呼叫、最後以 thenable 回傳 {data,error} 的假 query builder
function builder(data: unknown[], error: { message: string } | null = null) {
  const b: Record<string, unknown> = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.or = vi.fn(() => b);
  b.order = vi.fn(() => b);
  b.then = (resolve: (r: { data: unknown[]; error: { message: string } | null }) => unknown) =>
    resolve({ data, error });
  return b;
}

// 符合 zod schema 的最小合法資料（schemas 會丟棄結構不符的列）。
const member = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  family_id: 'fam1',
  display_name: 'A',
  avatar_color: '#000000',
  default_currency: 'TWD',
  ...over
});
const category = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: '餐飲',
  icon: '🍜',
  type: 'expense',
  is_shared: true,
  family_id: null,
  ...over
});

const INITIAL = useReferenceStore.getState();

describe('referenceStore', () => {
  beforeEach(() => {
    from.mockReset();
    useReferenceStore.setState(INITIAL, true);
  });

  it('ensureMembers 並發呼叫只發一次查詢', async () => {
    from.mockReturnValue(builder([member()]));
    await Promise.all([
      useReferenceStore.getState().ensureMembers('fam1'),
      useReferenceStore.getState().ensureMembers('fam1')
    ]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(useReferenceStore.getState().members).toHaveLength(1);
  });

  it('ensureMembers 已快取同一家庭時不再查詢', async () => {
    from.mockReturnValue(builder([member()]));
    await useReferenceStore.getState().ensureMembers('fam1');
    await useReferenceStore.getState().ensureMembers('fam1');
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('ensureMembers 換家庭會重新查詢', async () => {
    from.mockReturnValue(builder([member()]));
    await useReferenceStore.getState().ensureMembers('fam1');
    await useReferenceStore.getState().ensureMembers('fam2');
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('reloadMembers 強制重新查詢（改名後失效快取）', async () => {
    from.mockReturnValue(builder([member({ display_name: '舊名' })]));
    await useReferenceStore.getState().ensureMembers('fam1');
    expect(from).toHaveBeenCalledTimes(1);

    from.mockReturnValue(builder([member({ display_name: '新名' })]));
    await useReferenceStore.getState().reloadMembers('fam1');
    expect(from).toHaveBeenCalledTimes(2);
    expect((useReferenceStore.getState().members[0] as { display_name: string }).display_name).toBe('新名');
  });

  it('ensureMembers 換家庭時立即清空舊成員（避免短暫露出他家資料）', async () => {
    from.mockReturnValue(builder([member()]));
    await useReferenceStore.getState().ensureMembers('fam1');
    expect(useReferenceStore.getState().members).toHaveLength(1);

    from.mockReturnValue(builder([member({ id: 'u2', family_id: 'fam2' })]));
    const pending = useReferenceStore.getState().ensureMembers('fam2');
    expect(useReferenceStore.getState().members).toEqual([]); // 查詢解析前即清空
    await pending;
    expect(useReferenceStore.getState().members).toHaveLength(1);
  });

  it('ensureCategories 快取，reloadCategories 強制重新查詢', async () => {
    from.mockReturnValue(builder([category()]));
    await useReferenceStore.getState().ensureCategories('fam1');
    await useReferenceStore.getState().ensureCategories('fam1');
    expect(from).toHaveBeenCalledTimes(1);

    await useReferenceStore.getState().reloadCategories('fam1');
    expect(from).toHaveBeenCalledTimes(2);
    expect(useReferenceStore.getState().categories).toHaveLength(1);
  });

  it('分類查詢失敗：標記 error、derive 為非載入中，且仍可重試', async () => {
    from.mockReturnValue(builder([], { message: 'rls' }));
    await useReferenceStore.getState().ensureCategories('fam1');
    const s = useReferenceStore.getState();
    expect(s.categoriesError).toBe(true);
    expect(s.categoriesLoading).toBe(false);
    expect(s.loadedCategoriesFamilyId).toBeNull(); // 保留可重試
    expect(deriveReferenceLoading(s.categoriesLoading, s.loadedCategoriesFamilyId, 'fam1', s.categoriesError)).toBe(
      false
    );

    // 重試成功後恢復
    from.mockReturnValue(builder([category()]));
    await useReferenceStore.getState().ensureCategories('fam1');
    expect(from).toHaveBeenCalledTimes(2);
    expect(useReferenceStore.getState().categoriesError).toBe(false);
    expect(useReferenceStore.getState().categories).toHaveLength(1);
  });
});

describe('authStore.reset 清空參照快取', () => {
  it('登出 reset 後成員/分類與已載入標記皆清空', async () => {
    const { useAuthStore } = await import('./authStore');
    from.mockReturnValue(builder([member()]));
    await useReferenceStore.getState().ensureMembers('fam1');
    expect(useReferenceStore.getState().members).toHaveLength(1);

    useAuthStore.getState().reset();
    const state = useReferenceStore.getState();
    expect(state.members).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.loadedMembersFamilyId).toBeNull();
    expect(state.loadedCategoriesFamilyId).toBeNull();
  });
});

describe('deriveReferenceLoading', () => {
  it('冷啟動：尚未為當前家庭載入時視為載入中（避免 QuickAdd 誤判無類別）', () => {
    expect(deriveReferenceLoading(false, null, 'fam1')).toBe(true);
  });

  it('已為當前家庭載入完成：非載入中', () => {
    expect(deriveReferenceLoading(false, 'fam1', 'fam1')).toBe(false);
  });

  it('正在重新載入：視為載入中', () => {
    expect(deriveReferenceLoading(true, 'fam1', 'fam1')).toBe(true);
  });

  it('切換家庭、快取仍是舊家庭：視為載入中（避免顯示過期資料）', () => {
    expect(deriveReferenceLoading(false, 'fam1', 'fam2')).toBe(true);
  });

  it('尚未加入家庭：視為載入中（沿用原行為）', () => {
    expect(deriveReferenceLoading(false, null, undefined)).toBe(true);
  });

  it('上一次載入失敗：回報非載入中（避免無限轉圈）', () => {
    expect(deriveReferenceLoading(false, null, 'fam1', true)).toBe(false);
  });
});
