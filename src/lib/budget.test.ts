import { describe, expect, it } from 'vitest';
import type { Budget, MonthlySummary, Transaction } from '../types';
import {
  budgetStatus,
  budgetsForLedger,
  combineSummaries,
  computeBudgetProgress,
  computeSavings,
  findBudgetAmount,
  monthElapsedRatio,
  parseBudgetInput,
  resolveEffectiveBudgets,
  savingsTone
} from './budget';
import { parseBudgets } from './schemas';

function budget(overrides: Partial<Budget>): Budget {
  return {
    id: 'b',
    family_id: 'f1',
    owner_id: null,
    ledger_type: 'family',
    category_id: null,
    year_month: '2026-09',
    amount: 30000,
    currency: 'TWD',
    ...overrides
  };
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't',
    family_id: 'f1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 100,
    currency: 'TWD',
    category_id: 'food',
    transaction_date: '2026-09-10',
    created_at: '',
    updated_at: '',
    ...overrides
  };
}

describe('resolveEffectiveBudgets', () => {
  it('沿用最近一次設定：取 year_month ≤ 當月的最新一筆', () => {
    const rows = [
      budget({ id: 'old', year_month: '2026-06', amount: 20000 }),
      budget({ id: 'new', year_month: '2026-08', amount: 25000 }),
      budget({ id: 'future', year_month: '2026-10', amount: 99999 })
    ];
    expect(resolveEffectiveBudgets(rows, '2026-09').map((b) => b.id)).toEqual(['new']);
  });

  it('金額 0 代表自該月起取消，不列入', () => {
    const rows = [budget({ year_month: '2026-06' }), budget({ id: 'cancel', year_month: '2026-09', amount: 0 })];
    expect(resolveEffectiveBudgets(rows, '2026-09')).toEqual([]);
    expect(resolveEffectiveBudgets(rows, '2026-08')).toHaveLength(1);
  });

  it('不同帳本／類別／幣別各自獨立，總預算排最前', () => {
    const rows = [
      budget({ id: 'food', category_id: 'food' }),
      budget({ id: 'total' }),
      budget({ id: 'usd', currency: 'USD', amount: 300 }),
      budget({ id: 'mine', ledger_type: 'personal', owner_id: 'u1' })
    ];
    const ids = resolveEffectiveBudgets(rows, '2026-09').map((b) => b.id);
    expect(ids).toHaveLength(4);
    expect(ids.indexOf('food')).toBe(3);
  });
});

describe('computeBudgetProgress', () => {
  const transactions = [
    tx({ amount: 700, category_id: 'food' }),
    tx({ amount: 200, category_id: 'fun' }),
    tx({ amount: 5000, type: 'income', category_id: 'salary' }),
    tx({ amount: 20, currency: 'USD', category_id: 'food' })
  ];

  it('總預算計入同幣別全部支出，不計收入與他幣別', () => {
    const [progress] = computeBudgetProgress([budget({ amount: 1000 })], transactions);
    expect(progress.spent).toBe(900);
    expect(progress.ratio).toBeCloseTo(0.9);
    expect(progress.status).toBe('warning');
  });

  it('類別預算只計該類別', () => {
    const [progress] = computeBudgetProgress([budget({ category_id: 'food', amount: 500 })], transactions);
    expect(progress.spent).toBe(700);
    expect(progress.status).toBe('over');
  });

  it('USD 預算只計 USD', () => {
    const [progress] = computeBudgetProgress([budget({ currency: 'USD', amount: 100 })], transactions);
    expect(progress.spent).toBe(20);
    expect(progress.status).toBe('ok');
  });
});

describe('budgetStatus', () => {
  it('80% 以下正常、80–100% 提醒、超過 100% 超支', () => {
    expect(budgetStatus(0.79)).toBe('ok');
    expect(budgetStatus(0.8)).toBe('warning');
    expect(budgetStatus(1)).toBe('warning');
    expect(budgetStatus(1.01)).toBe('over');
  });
});

describe('budgetsForLedger / findBudgetAmount', () => {
  const rows = [
    budget({ id: 'fam' }),
    budget({ id: 'mine', ledger_type: 'personal', owner_id: 'u1', amount: 8000 }),
    budget({ id: 'theirs', ledger_type: 'personal', owner_id: 'u2' })
  ];

  it('個人預算只取本人的', () => {
    expect(budgetsForLedger(rows, 'personal', 'u1').map((b) => b.id)).toEqual(['mine']);
    expect(budgetsForLedger(rows, 'family', 'u1').map((b) => b.id)).toEqual(['fam']);
  });

  it('找出某一格目前的金額，沒有則 null', () => {
    expect(findBudgetAmount(rows, 'family', null, 'TWD')).toBe(30000);
    expect(findBudgetAmount(rows, 'family', 'food', 'TWD')).toBeNull();
  });
});

describe('儲蓄率', () => {
  const family: MonthlySummary = {
    income: { TWD: 0, USD: 0 },
    expense: { TWD: 30000, USD: 0 },
    balance: { TWD: -30000, USD: 0 }
  };
  const personal: MonthlySummary = {
    income: { TWD: 80000, USD: 100 },
    expense: { TWD: 10000, USD: 0 },
    balance: { TWD: 70000, USD: 100 }
  };

  it('合計 = 各帳本相加，儲蓄率 =（收入 − 支出）÷ 收入', () => {
    const savings = computeSavings(combineSummaries(family, personal), 'TWD');
    expect(savings).toEqual({ income: 80000, expense: 40000, balance: 40000, rate: 0.5 });
  });

  it('沒有收入時儲蓄率為 null', () => {
    expect(computeSavings(family, 'TWD').rate).toBeNull();
  });

  it('健康度分級', () => {
    expect(savingsTone(null)).toBe('none');
    expect(savingsTone(-0.1)).toBe('bad');
    expect(savingsTone(0.1)).toBe('fair');
    expect(savingsTone(0.2)).toBe('good');
  });
});

describe('parseBudgets', () => {
  it('numeric 字串轉數字、char(7) 去空白', () => {
    const [row] = parseBudgets([{ ...budget({}), amount: '1234.50', year_month: '2026-09 ' }]);
    expect(row.amount).toBe(1234.5);
    expect(row.year_month).toBe('2026-09');
  });
});

describe('monthElapsedRatio / parseBudgetInput', () => {
  it('依當月天數計算已過比例', () => {
    expect(monthElapsedRatio(new Date(2026, 8, 15))).toBe(0.5);
    expect(monthElapsedRatio(new Date(2026, 1, 28))).toBe(1);
  });

  it('空白＝取消、千分位可接受、無效輸入回傳 null', () => {
    expect(parseBudgetInput('', 'TWD')).toBe(0);
    expect(parseBudgetInput('30,000', 'TWD')).toBe(30000);
    expect(parseBudgetInput('12.345', 'USD')).toBe(12.35);
    expect(parseBudgetInput('abc', 'TWD')).toBeNull();
    expect(parseBudgetInput('-5', 'TWD')).toBeNull();
  });
});
