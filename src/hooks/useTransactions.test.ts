import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Transaction } from '../types';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { fetchTransactions, filterTransactionsByMonth } from './useTransactions';

// 紀錄 query builder 上每個過濾呼叫，最後以 thenable 回傳 {data,error}
function makeBuilder(calls: Array<[string, string, unknown]>) {
  const builder: Record<string, unknown> = {};
  const record = (m: string) => (k: string, v: unknown) => {
    calls.push([m, k, v]);
    return builder;
  };
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(record('eq'));
  builder.gte = vi.fn(record('gte'));
  builder.lte = vi.fn(record('lte'));
  builder.order = vi.fn(() => builder);
  builder.then = (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return builder;
}

const profile = { id: 'u1', family_id: 'fam1' };

describe('fetchTransactions', () => {
  let calls: Array<[string, string, unknown]>;
  beforeEach(() => {
    calls = [];
    from.mockReset();
    from.mockReturnValue(makeBuilder(calls));
  });

  it('family 帳本以 family_id 過濾並套用日期範圍', async () => {
    await fetchTransactions({ ledgerType: 'family', profile, from: '2026-01-01', to: '2026-06-30' });
    expect(from).toHaveBeenCalledWith('transactions');
    expect(calls).toContainEqual(['eq', 'ledger_type', 'family']);
    expect(calls).toContainEqual(['eq', 'family_id', 'fam1']);
    expect(calls).not.toContainEqual(['eq', 'owner_id', 'u1']);
    expect(calls).toContainEqual(['gte', 'transaction_date', '2026-01-01']);
    expect(calls).toContainEqual(['lte', 'transaction_date', '2026-06-30']);
  });

  it('personal 帳本以 owner_id 過濾', async () => {
    await fetchTransactions({ ledgerType: 'personal', profile, from: '2026-06-01', to: '2026-06-30' });
    expect(calls).toContainEqual(['eq', 'ledger_type', 'personal']);
    expect(calls).toContainEqual(['eq', 'owner_id', 'u1']);
    expect(calls).not.toContainEqual(['eq', 'family_id', 'fam1']);
  });
});

describe('filterTransactionsByMonth', () => {
  const tx = (id: string, date: string): Transaction =>
    ({ id, transaction_date: date } as Transaction);

  it('只保留指定月份、且維持原順序', () => {
    const rows = [
      tx('a', '2026-06-30'),
      tx('b', '2026-05-31'),
      tx('c', '2026-06-01'),
      tx('d', '2026-07-01'),
      tx('e', '2026-06-15')
    ];
    const result = filterTransactionsByMonth(rows, '2026-06');
    expect(result.map((r) => r.id)).toEqual(['a', 'c', 'e']);
  });

  it('沒有該月份資料時回傳空陣列', () => {
    expect(filterTransactionsByMonth([tx('a', '2026-05-01')], '2026-06')).toEqual([]);
  });
});
