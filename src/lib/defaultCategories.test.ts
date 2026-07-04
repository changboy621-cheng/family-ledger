import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, buildFamilyCategoryRows } from './defaultCategories';

describe('DEFAULT_CATEGORIES', () => {
  it('同時涵蓋支出與收入類別', () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.type === 'expense')).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.type === 'income')).toBe(true);
  });

  it('每個類別都有名稱、圖示與遞增的 sort_order', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.name.trim()).not.toBe('');
      expect(category.icon.trim()).not.toBe('');
      expect(typeof category.sort_order).toBe('number');
    }
  });
});

describe('buildFamilyCategoryRows', () => {
  it('為指定家庭產生每個預設類別一列（family_id 綁定、is_shared 為 true）', () => {
    const rows = buildFamilyCategoryRows('fam-1');
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
    for (const row of rows) {
      expect(row.family_id).toBe('fam-1');
      expect(row.is_shared).toBe(true);
    }
    expect(rows.map((r) => r.name)).toEqual(DEFAULT_CATEGORIES.map((c) => c.name));
  });

  it('不同家庭產生的列彼此獨立（不共用參照）', () => {
    const a = buildFamilyCategoryRows('fam-a');
    const b = buildFamilyCategoryRows('fam-b');
    expect(a[0]).not.toBe(b[0]);
    expect(a[0].family_id).toBe('fam-a');
    expect(b[0].family_id).toBe('fam-b');
  });
});
