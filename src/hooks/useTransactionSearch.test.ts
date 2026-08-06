import { describe, expect, it, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { buildSearchQueries } from './useTransactionSearch';

// 紀錄 query builder 上每個過濾呼叫，最後以 thenable 回傳 {data,error}
function makeBuilder(calls: Array<[string, ...unknown[]]>) {
  const builder: Record<string, unknown> = {};
  const record = (m: string) => (...args: unknown[]) => {
    calls.push([m, ...args]);
    return builder;
  };
  builder.select = vi.fn(record('select'));
  builder.eq = vi.fn(record('eq'));
  builder.ilike = vi.fn(record('ilike'));
  builder.in = vi.fn(record('in'));
  builder.order = vi.fn(record('order'));
  builder.limit = vi.fn(record('limit'));
  builder.then = (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return builder;
}

const profile = { id: 'u1', family_id: 'fam1' };

describe('buildSearchQueries', () => {
  let calls: Array<[string, ...unknown[]]>;
  beforeEach(() => {
    calls = [];
    from.mockReset();
    from.mockReturnValue(makeBuilder(calls));
  });

  it('keyword 模式：note ilike（含跳脫）、無日期範圍、上限 300', () => {
    const queries = buildSearchQueries('family', profile, {
      kind: 'keyword',
      keyword: '50%',
      categoryIds: []
    });
    expect(queries).toHaveLength(1);
    expect(calls).toContainEqual(['eq', 'ledger_type', 'family']);
    expect(calls).toContainEqual(['eq', 'family_id', 'fam1']);
    expect(calls).toContainEqual(['ilike', 'note', '%50\\%%']);
    expect(calls).toContainEqual(['limit', 300]);
    expect(calls.some(([m]) => m === 'gte' || m === 'lte')).toBe(false);
  });

  it('keyword 模式有符合分類時，另發 category_id in 查詢', () => {
    const queries = buildSearchQueries('family', profile, {
      kind: 'keyword',
      keyword: '餐',
      categoryIds: ['c1', 'c3']
    });
    expect(queries).toHaveLength(2);
    expect(calls).toContainEqual(['in', 'category_id', ['c1', 'c3']]);
  });

  it('category 模式：以 category_id 過濾、personal 以 owner_id 過濾', () => {
    buildSearchQueries('personal', profile, { kind: 'category', categoryId: 'c9' });
    expect(calls).toContainEqual(['eq', 'category_id', 'c9']);
    expect(calls).toContainEqual(['eq', 'owner_id', 'u1']);
    expect(calls).not.toContainEqual(['eq', 'family_id', 'fam1']);
  });
});
