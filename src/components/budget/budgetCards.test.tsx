// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Budget, Category, MonthlySummary, Transaction } from '../../types';
import { SavingsCard } from './SavingsCard';
import { BudgetProgressCard } from './BudgetProgressCard';

afterEach(() => {
  cleanup();
});

const empty: MonthlySummary = {
  income: { TWD: 0, USD: 0 },
  expense: { TWD: 0, USD: 0 },
  balance: { TWD: 0, USD: 0 }
};

describe('SavingsCard', () => {
  it('合計家庭＋個人並顯示儲蓄率', () => {
    render(
      <SavingsCard
        familySummary={{ ...empty, expense: { TWD: 30000, USD: 0 } }}
        personalSummary={{ ...empty, income: { TWD: 100000, USD: 0 }, expense: { TWD: 10000, USD: 0 } }}
      />
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('NT$60,000')).toBeInTheDocument();
  });

  it('沒有收入時提示記錄收入', () => {
    render(<SavingsCard familySummary={empty} personalSummary={empty} />);
    expect(screen.getByText(/本月還沒有收入紀錄/)).toBeInTheDocument();
  });
});

const food: Category = { id: 'food', name: '餐飲', icon: '🍜', type: 'expense', is_shared: true };

function budget(overrides: Partial<Budget>): Budget {
  return {
    id: 'b1',
    family_id: 'f1',
    owner_id: null,
    ledger_type: 'family',
    category_id: null,
    year_month: '2026-09',
    amount: 1000,
    currency: 'TWD',
    ...overrides
  };
}

const spend: Transaction = {
  id: 't1',
  family_id: 'f1',
  owner_id: 'u1',
  ledger_type: 'family',
  type: 'expense',
  amount: 1200,
  currency: 'TWD',
  category_id: 'food',
  transaction_date: '2026-09-10',
  created_at: '',
  updated_at: ''
};

function renderCard(budgets: Budget[]) {
  return render(
    <MemoryRouter>
      <BudgetProgressCard
        budgets={budgets}
        profileId="u1"
        familyTransactions={[spend]}
        personalTransactions={[]}
        categories={[food]}
        monthElapsed={0.5}
      />
    </MemoryRouter>
  );
}

describe('BudgetProgressCard', () => {
  it('沒有預算時引導到設定', () => {
    renderCard([]);
    expect(screen.getByText(/還沒有設定預算/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('href', '/settings#budget');
  });

  it('顯示總預算與類別預算進度，超支標示', () => {
    renderCard([budget({}), budget({ id: 'b2', category_id: 'food', amount: 2000 })]);
    expect(screen.getByText('總預算')).toBeInTheDocument();
    expect(screen.getByText('超支 NT$200')).toBeInTheDocument();
    expect(screen.getByText('🍜 餐飲')).toBeInTheDocument();
    expect(screen.getByText('剩 NT$800')).toBeInTheDocument();
  });
});
