// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CategoryExpenseSummary } from '../../types';
import { ExpenseCategorySummary } from './ExpenseCategorySummary';

const items: CategoryExpenseSummary[] = [
  {
    categoryId: 'c1',
    categoryName: '餐飲',
    categoryIcon: '🍜',
    totals: { TWD: 3240, USD: 0 },
    ratios: { TWD: 0.5, USD: 0 }
  }
];

afterEach(() => {
  cleanup();
});

describe('ExpenseCategorySummary onSelectCategory', () => {
  it('有傳入時列可點，回傳分類資訊', () => {
    const onSelect = vi.fn();
    render(<ExpenseCategorySummary items={items} currencyFilter="all" onSelectCategory={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /餐飲/ }));
    expect(onSelect).toHaveBeenCalledWith({ categoryId: 'c1', categoryName: '餐飲', categoryIcon: '🍜' });
  });

  it('未傳入時不渲染按鈕（維持純顯示）', () => {
    render(<ExpenseCategorySummary items={items} currencyFilter="all" />);
    expect(screen.queryByRole('button', { name: /餐飲/ })).toBeNull();
  });
});
