import { describe, expect, it } from 'vitest';
import { analyzeLedgerTransactions } from './useLedgerAnalysis';
import type { Transaction } from '../types';

const transactions: Transaction[] = [
  {
    id: 't1',
    family_id: 'f1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 500,
    currency: 'TWD',
    category_id: 'c-food',
    transaction_date: '2026-06-01',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    category: { id: 'c-food', name: '餐飲', icon: '🍽️', type: 'expense', is_shared: true },
    owner: { id: 'u1', family_id: 'f1', display_name: '老大', avatar_color: '#111111', default_currency: 'TWD' }
  },
  {
    id: 't2',
    family_id: 'f1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 120,
    currency: 'USD',
    category_id: 'c-travel',
    transaction_date: '2026-06-02',
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
    category: { id: 'c-travel', name: '旅遊', icon: '✈️', type: 'expense', is_shared: true },
    owner: { id: 'u1', family_id: 'f1', display_name: '老大', avatar_color: '#111111', default_currency: 'TWD' }
  },
  {
    id: 't3',
    family_id: 'f1',
    owner_id: 'u2',
    ledger_type: 'family',
    type: 'expense',
    amount: 800,
    currency: 'TWD',
    category_id: 'c-food',
    transaction_date: '2026-06-03',
    created_at: '2026-06-03T00:00:00Z',
    updated_at: '2026-06-03T00:00:00Z',
    category: { id: 'c-food', name: '餐飲', icon: '🍽️', type: 'expense', is_shared: true },
    owner: { id: 'u2', family_id: 'f1', display_name: '老婆', avatar_color: '#222222', default_currency: 'USD' }
  },
  {
    id: 't4',
    family_id: 'f1',
    owner_id: 'u2',
    ledger_type: 'family',
    type: 'income',
    amount: 2000,
    currency: 'TWD',
    category_id: 'c-salary',
    transaction_date: '2026-06-04',
    created_at: '2026-06-04T00:00:00Z',
    updated_at: '2026-06-04T00:00:00Z',
    category: { id: 'c-salary', name: '薪資', icon: '💰', type: 'income', is_shared: true },
    owner: { id: 'u2', family_id: 'f1', display_name: '老婆', avatar_color: '#222222', default_currency: 'USD' }
  },
  {
    id: 't5',
    family_id: 'f1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 200,
    currency: 'TWD',
    category_id: 'c-traffic',
    transaction_date: '2026-05-10',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    category: { id: 'c-traffic', name: '交通', icon: '🚗', type: 'expense', is_shared: true },
    owner: { id: 'u1', family_id: 'f1', display_name: '老大', avatar_color: '#111111', default_currency: 'TWD' }
  },
  {
    id: 't6',
    family_id: 'f1',
    owner_id: 'u2',
    ledger_type: 'family',
    type: 'expense',
    amount: 300,
    currency: 'TWD',
    category_id: 'c-home',
    transaction_date: '2026-04-06',
    created_at: '2026-04-06T00:00:00Z',
    updated_at: '2026-04-06T00:00:00Z',
    category: { id: 'c-home', name: '居家', icon: '🏠', type: 'expense', is_shared: true },
    owner: { id: 'u2', family_id: 'f1', display_name: '老婆', avatar_color: '#222222', default_currency: 'USD' }
  }
];

describe('analyzeLedgerTransactions', () => {
  it('separates income, expense, and balance by currency', () => {
    const analysis = analyzeLedgerTransactions(transactions, '2026-06');

    expect(analysis.summary.expense).toEqual({ TWD: 1300, USD: 120 });
    expect(analysis.summary.income).toEqual({ TWD: 2000, USD: 0 });
    expect(analysis.summary.balance).toEqual({ TWD: 700, USD: -120 });
  });

  it('groups expense totals by category and sorts descending within currency impact', () => {
    const analysis = analyzeLedgerTransactions(transactions, '2026-06');

    expect(analysis.expenseByCategory).toHaveLength(2);
    expect(analysis.expenseByCategory[0]).toMatchObject({
      categoryId: 'c-food',
      categoryName: '餐飲',
      totals: { TWD: 1300, USD: 0 },
      ratios: { TWD: 1, USD: 0 }
    });
    expect(analysis.expenseByCategory[1]).toMatchObject({
      categoryId: 'c-travel',
      categoryName: '旅遊',
      totals: { TWD: 0, USD: 120 },
      ratios: { TWD: 0, USD: 1 }
    });
  });

  it('groups expenses by owner with nested category totals', () => {
    const analysis = analyzeLedgerTransactions(transactions, '2026-06');

    expect(analysis.expenseByOwner).toHaveLength(2);
    expect(analysis.expenseByOwner[0]).toMatchObject({
      ownerId: 'u2',
      ownerName: '老婆',
      totals: { TWD: 800, USD: 0 },
      ratios: { TWD: 800 / 1300, USD: 0 }
    });
    expect(analysis.expenseByOwner[1]).toMatchObject({
      ownerId: 'u1',
      ownerName: '老大',
      totals: { TWD: 500, USD: 120 },
      ratios: { TWD: 500 / 1300, USD: 1 }
    });
    expect(analysis.expenseByOwner[1].categories[0]).toMatchObject({
      categoryId: 'c-food',
      totals: { TWD: 500, USD: 0 },
      ratios: { TWD: 500 / 1300, USD: 0 }
    });
  });

  it('returns top categories and daily trend for the selected month only', () => {
    const analysis = analyzeLedgerTransactions(transactions, '2026-06');

    expect(analysis.topCategories.map((item) => item.categoryId)).toEqual(['c-food', 'c-travel']);
    expect(analysis.dailyExpenseTrend.find((point) => point.day === 1)?.totals.TWD).toBe(500);
    expect(analysis.dailyExpenseTrend.find((point) => point.day === 2)?.totals.USD).toBe(120);
    expect(analysis.dailyExpenseTrend.find((point) => point.day === 10)?.totals.TWD).toBe(0);
  });

  it('returns a rolling six month trend including the selected month', () => {
    const analysis = analyzeLedgerTransactions(transactions, '2026-06');

    expect(analysis.monthlyExpenseTrend).toHaveLength(6);
    expect(analysis.monthlyExpenseTrend[4]).toMatchObject({
      yearMonth: '2026-05',
      totals: { TWD: 200, USD: 0 }
    });
    expect(analysis.monthlyExpenseTrend[5]).toMatchObject({
      yearMonth: '2026-06',
      totals: { TWD: 1300, USD: 120 }
    });
  });

  it('skips invalid transaction dates instead of crashing the ledger page', () => {
    const analysis = analyzeLedgerTransactions(
      [
        ...transactions,
        {
          ...transactions[0],
          id: 'bad-date',
          transaction_date: 'not-a-date'
        }
      ],
      '2026-06'
    );

    expect(analysis.summary.expense).toEqual({ TWD: 1300, USD: 120 });
    expect(analysis.dailyExpenseTrend.find((point) => point.day === 1)?.totals.TWD).toBe(500);
  });
});
