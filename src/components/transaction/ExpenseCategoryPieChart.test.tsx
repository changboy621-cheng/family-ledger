// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CategoryExpenseSummary } from '../../types';
import { ExpenseCategoryPieChart } from './ExpenseCategoryPieChart';

function makeItem(id: string, name: string, twd: number): CategoryExpenseSummary {
  return {
    categoryId: id,
    categoryName: name,
    categoryIcon: '🍜',
    totals: { TWD: twd, USD: 0 },
    ratios: { TWD: 0, USD: 0 }
  };
}

afterEach(() => {
  cleanup();
});

describe('ExpenseCategoryPieChart', () => {
  it('無資料時顯示空狀態', () => {
    render(<ExpenseCategoryPieChart items={[]} currencyFilter="all" />);
    expect(screen.getByText('本月尚無支出分類資料。')).toBeInTheDocument();
  });

  it('傳入 onSelectCategory 時圖例可點，回傳分類資訊', () => {
    const onSelect = vi.fn();
    render(
      <ExpenseCategoryPieChart
        items={[makeItem('c1', '餐飲', 3000)]}
        currencyFilter="all"
        onSelectCategory={onSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /餐飲/ }));
    expect(onSelect).toHaveBeenCalledWith({ categoryId: 'c1', categoryName: '餐飲', categoryIcon: '🍜' });
  });

  it('未傳入 onSelectCategory 時維持純顯示（不渲染按鈕）', () => {
    render(<ExpenseCategoryPieChart items={[makeItem('c1', '餐飲', 3000)]} currencyFilter="all" />);
    expect(screen.queryByRole('button', { name: /餐飲/ })).toBeNull();
  });

  it('超過 8 個分類時把尾端折進「其他」', () => {
    const items = Array.from({ length: 10 }, (_, index) => makeItem(`c${index}`, `分類${index}`, 100 - index));
    render(<ExpenseCategoryPieChart items={items} currencyFilter="all" />);
    // 前 7 名保留，其餘折成單一「其他」列。
    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('分類0')).toBeInTheDocument();
    expect(screen.queryByText('分類9')).toBeNull();
  });

  it('折疊而成的「其他」不可下鑽（無單一分類）', () => {
    const onSelect = vi.fn();
    const items = Array.from({ length: 10 }, (_, index) => makeItem(`c${index}`, `分類${index}`, 100 - index));
    render(<ExpenseCategoryPieChart items={items} currencyFilter="all" onSelectCategory={onSelect} />);
    expect(screen.queryByRole('button', { name: /其他/ })).toBeNull();
  });
});
