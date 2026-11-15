import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { buildYearReport, compareMonth, shiftMonth } from './reports';

let seq = 0;
const tx = (date: string, amount: number, categoryId: string, type: 'expense' | 'income' = 'expense', currency: 'TWD' | 'USD' = 'TWD'): Transaction => ({
  id: `t${(seq += 1)}`,
  family_id: 'f',
  owner_id: 'u',
  ledger_type: 'family',
  type,
  amount,
  currency,
  category_id: categoryId,
  transaction_date: date,
  created_at: '',
  updated_at: '',
  category: { id: categoryId, name: categoryId, icon: '•', type, is_shared: true }
});

describe('reports', () => {
  const data = [
    tx('2026-01-05', 50000, 'salary', 'income'),
    tx('2026-01-10', 3000, 'food'),
    tx('2026-01-20', 12000, 'rent'),
    tx('2026-02-03', 4500, 'food'),
    tx('2026-02-04', 99, 'food', 'expense', 'USD'),
    tx('2025-02-10', 2000, 'food'),
    tx('2025-12-31', 800, 'food')
  ];

  it('年度報表：每月收支、總計、儲蓄率、分類排行、最大筆', () => {
    const report = buildYearReport(data, 2026);
    expect(report.months[0]).toEqual({ month: '2026-01', income: 50000, expense: 15000 });
    expect(report.months[1].expense).toBe(4500);
    expect(report.expense).toBe(19500);
    expect(report.balance).toBe(30500);
    expect(report.savingsRate).toBeCloseTo(0.61);
    expect(report.categories.map((item) => [item.categoryId, item.total])).toEqual([
      ['rent', 12000],
      ['food', 7500]
    ]);
    expect(report.topExpenses[0].amount).toBe(12000);
  });

  it('沒有收入時儲蓄率為 null', () => {
    expect(buildYearReport([tx('2026-03-01', 100, 'food')], 2026).savingsRate).toBeNull();
  });

  it('月對月：本月 vs 上月 vs 去年同月，標出明顯變化', () => {
    const { rows, totals } = compareMonth(data, '2026-02');
    const food = rows.find((row) => row.categoryId === 'food')!;
    expect(food).toMatchObject({ current: 4500, lastMonth: 3000, lastYear: 2000, notable: 'up' });
    expect(food.vsLastMonth).toBeCloseTo(0.5);
    const rent = rows.find((row) => row.categoryId === 'rent')!;
    expect(rent).toMatchObject({ current: 0, lastMonth: 12000, notable: 'down' });
    expect(totals).toEqual({ current: 4500, lastMonth: 15000, lastYear: 2000 });
  });

  it('月份位移跨年', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-01', -12)).toBe('2025-01');
  });
});
