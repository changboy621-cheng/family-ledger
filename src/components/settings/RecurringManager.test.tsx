// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RecurringTransaction } from '../../types';

const rules: RecurringTransaction[] = [
  {
    id: 'r1',
    family_id: 'f1',
    owner_id: 'u2',
    ledger_type: 'family',
    type: 'expense',
    amount: 25000,
    currency: 'TWD',
    category_id: 'rent',
    note: '房租',
    payment_method: null,
    day_of_month: 5,
    start_month: '2026-01',
    last_generated_month: '2099-01',
    active: true
  },
  {
    id: 'r2',
    family_id: 'f1',
    owner_id: 'u1',
    ledger_type: 'personal',
    type: 'income',
    amount: 80000,
    currency: 'TWD',
    category_id: 'salary',
    note: null,
    payment_method: null,
    day_of_month: 31,
    start_month: '2026-01',
    last_generated_month: null,
    active: false
  }
];
const deleteRule = vi.fn(() => Promise.resolve());

vi.mock('../../hooks/useRecurring', () => ({
  useRecurringRules: () => ({
    rules,
    loading: false,
    error: false,
    reload: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    setActive: vi.fn(),
    deleteRule
  })
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: (type: string) => ({
    categories:
      type === 'expense'
        ? [{ id: 'rent', name: '居住', icon: '🏠', type: 'expense', is_shared: true }]
        : [{ id: 'salary', name: '薪資', icon: '💰', type: 'income', is_shared: true }]
  })
}));
vi.mock('../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({ members: [{ id: 'u1', display_name: '我' }, { id: 'u2', display_name: '太太' }] })
}));
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ profile: { id: 'u1' } })
}));

import { RecurringManager } from './RecurringManager';

afterEach(cleanup);

describe('RecurringManager', () => {
  it('列出規則：備註優先、無備註用類別名，顯示帳本、歸屬人、排程與暫停狀態', () => {
    render(<RecurringManager />);
    expect(screen.getByText('房租')).toBeInTheDocument();
    expect(screen.getByText(/・太太・每月 5 號・下次/)).toBeInTheDocument();
    expect(screen.getByText('薪資')).toBeInTheDocument();
    expect(screen.getByText(/短月份記在月底）・已暫停/)).toBeInTheDocument();
    expect(screen.getByText('+NT$80,000')).toBeInTheDocument();
  });

  it('刪除需先確認', () => {
    render(<RecurringManager />);
    fireEvent.click(screen.getAllByRole('button', { name: '刪除' })[0]);
    expect(deleteRule).not.toHaveBeenCalled();
    expect(screen.getByText(/已記入的交易保留/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '刪除' })[0]);
    expect(deleteRule).toHaveBeenCalledWith('r1');
  });
});
