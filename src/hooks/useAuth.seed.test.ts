import { describe, expect, it, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { seedFamilyCategories } from './useAuth';
import { DEFAULT_CATEGORIES } from '../lib/defaultCategories';

describe('seedFamilyCategories', () => {
  beforeEach(() => from.mockReset());

  it('對指定家庭插入整份預設類別', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await seedFamilyCategories('fam-1');

    expect(from).toHaveBeenCalledWith('categories');
    const rows = insert.mock.calls[0][0] as Array<{ family_id: string }>;
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(rows.every((r) => r.family_id === 'fam-1')).toBe(true);
  });

  it('插入失敗僅記錄警告，不丟出錯誤（不阻斷註冊）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) });

    await expect(seedFamilyCategories('fam-1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
