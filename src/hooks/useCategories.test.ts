import { describe, expect, it, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { ensureCategoryDeletable } from './useCategories';

// 針對「刪除前守門」的查詢建構器：記錄過濾條件，最後以 thenable 回傳 {data,error}
function makeBuilder(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = { calls };
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((k: string, v: unknown) => {
    calls.push([k, v]);
    return builder;
  });
  builder.limit = vi.fn(() => Promise.resolve(result));
  return builder as typeof builder & { calls: Array<[string, unknown]> };
}

describe('ensureCategoryDeletable', () => {
  beforeEach(() => from.mockReset());

  it('查詢 transactions 是否有帳目使用此類別', async () => {
    const builder = makeBuilder({ data: [], error: null });
    from.mockReturnValue(builder);

    await ensureCategoryDeletable('cat-1');

    expect(from).toHaveBeenCalledWith('transactions');
    expect(builder.calls).toContainEqual(['category_id', 'cat-1']);
  });

  it('已有帳目使用時丟出友善錯誤', async () => {
    from.mockReturnValue(makeBuilder({ data: [{ id: 'tx-1' }], error: null }));
    await expect(ensureCategoryDeletable('cat-1')).rejects.toThrow('此類別已有帳目使用，無法刪除');
  });

  it('查詢出錯時往外拋，不誤判為可刪除', async () => {
    from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
    await expect(ensureCategoryDeletable('cat-1')).rejects.toBeTruthy();
  });
});
