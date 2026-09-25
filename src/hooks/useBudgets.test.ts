import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { writeBudget } from './useBudgets';

// 查詢建構器：記錄 eq / is 過濾條件，limit 回傳既有列，update / insert 記錄寫入內容。
function makeBuilder(existing: { id: string }[]) {
  const filters: Array<[string, string, unknown]> = [];
  const writes: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = { filters, writes };
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((k: string, v: unknown) => {
    filters.push(['eq', k, v]);
    return builder;
  });
  builder.is = vi.fn((k: string, v: unknown) => {
    filters.push(['is', k, v]);
    return builder;
  });
  builder.limit = vi.fn(() => Promise.resolve({ data: existing, error: null }));
  builder.update = vi.fn((patch: unknown) => {
    writes.push(['update', patch]);
    return { eq: vi.fn(() => Promise.resolve({ error: null })) };
  });
  builder.insert = vi.fn((row: unknown) => {
    writes.push(['insert', row]);
    return Promise.resolve({ error: null });
  });
  return builder as typeof builder & {
    filters: Array<[string, string, unknown]>;
    writes: Array<[string, unknown]>;
  };
}

const base = { familyId: 'f1', profileId: 'u1', yearMonth: '2026-09', currency: 'TWD' as const };

describe('writeBudget', () => {
  beforeEach(() => from.mockReset());

  it('家庭總預算：owner / category 以 is null 比對，無既有列則新增', async () => {
    const builder = makeBuilder([]);
    from.mockReturnValue(builder);

    await writeBudget({ ...base, ledgerType: 'family', categoryId: null, amount: 30000 });

    expect(builder.filters).toContainEqual(['is', 'owner_id', null]);
    expect(builder.filters).toContainEqual(['is', 'category_id', null]);
    expect(builder.writes).toEqual([
      [
        'insert',
        {
          family_id: 'f1',
          owner_id: null,
          ledger_type: 'family',
          category_id: null,
          year_month: '2026-09',
          amount: 30000,
          currency: 'TWD'
        }
      ]
    ]);
  });

  it('個人類別預算：owner 為本人，同月已有列則更新金額', async () => {
    const builder = makeBuilder([{ id: 'b1' }]);
    from.mockReturnValue(builder);

    await writeBudget({ ...base, ledgerType: 'personal', categoryId: 'food', amount: 5000 });

    expect(builder.filters).toContainEqual(['eq', 'owner_id', 'u1']);
    expect(builder.filters).toContainEqual(['eq', 'category_id', 'food']);
    expect(builder.writes).toEqual([['update', { amount: 5000 }]]);
  });
});
