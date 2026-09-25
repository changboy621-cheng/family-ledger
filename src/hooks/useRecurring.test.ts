import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { generateDueRecurring } from './useRecurring';

const rule = {
  id: 'r1',
  family_id: 'f1',
  owner_id: 'u1',
  ledger_type: 'family',
  type: 'expense',
  amount: '25000.00',
  currency: 'TWD',
  category_id: 'rent',
  note: '房租',
  payment_method: null,
  day_of_month: 5,
  start_month: '2026-07',
  last_generated_month: '2026-07',
  active: true
};

// 依資料表回傳不同的建構器，記錄 upsert 與 update 的內容。
function setup(options: { rules: unknown[]; inserted: unknown[] }) {
  const upserts: Array<{ rows: unknown; opts: unknown }> = [];
  const updates: Array<{ patch: unknown; id: unknown }> = [];

  from.mockImplementation((table: string) => {
    if (table === 'recurring_transactions') {
      const query: Record<string, unknown> = {};
      let eqCount = 0;
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => {
        eqCount += 1;
        return eqCount >= 2 ? Promise.resolve({ data: options.rules, error: null }) : query;
      });
      query.update = vi.fn((patch: unknown) => ({
        eq: vi.fn((_: string, id: unknown) => {
          updates.push({ patch, id });
          return Promise.resolve({ error: null });
        })
      }));
      return query;
    }
    return {
      upsert: vi.fn((rows: unknown, opts: unknown) => {
        upserts.push({ rows, opts });
        return { select: vi.fn(() => Promise.resolve({ data: options.inserted, error: null })) };
      })
    };
  });

  return { upserts, updates };
}

describe('generateDueRecurring', () => {
  beforeEach(() => from.mockReset());

  it('補記到期月份、以唯一鍵忽略重複，並推進已處理月份', async () => {
    const { upserts, updates } = setup({ rules: [rule], inserted: [{ id: 't1' }, { id: 't2' }] });

    const created = await generateDueRecurring('f1', 'u2', new Date(2026, 8, 25));

    expect(created).toBe(2);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].opts).toEqual({ onConflict: 'recurring_id,recurring_month', ignoreDuplicates: true });
    expect(upserts[0].rows).toMatchObject([
      { transaction_date: '2026-08-05', recurring_month: '2026-08', recorded_by: 'u2', owner_id: 'u1', amount: 25000 },
      { transaction_date: '2026-09-05', recurring_month: '2026-09' }
    ]);
    expect(updates).toEqual([{ patch: { last_generated_month: '2026-09' }, id: 'r1' }]);
  });

  it('另一台裝置已記過（唯一鍵衝突）：回傳 0 筆，仍推進已處理月份', async () => {
    const { updates } = setup({ rules: [rule], inserted: [] });
    expect(await generateDueRecurring('f1', 'u1', new Date(2026, 8, 25))).toBe(0);
    expect(updates).toHaveLength(1);
  });

  it('沒有到期月份時不寫入', async () => {
    const { upserts, updates } = setup({ rules: [{ ...rule, last_generated_month: '2026-09' }], inserted: [] });
    expect(await generateDueRecurring('f1', 'u1', new Date(2026, 8, 25))).toBe(0);
    expect(upserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});
