// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OwnerExpenseSummary } from '../../types';
import { SpenderAnalysis } from './SpenderAnalysis';

const items: OwnerExpenseSummary[] = [
  {
    ownerId: 'u1',
    ownerName: '美老婆',
    avatarColor: '#ef4444',
    totals: { TWD: 36242, USD: 0 },
    ratios: { TWD: 1, USD: 0 },
    categories: [
      {
        categoryId: 'c1',
        categoryName: '居家生活',
        categoryIcon: '🏦',
        totals: { TWD: 36242, USD: 0 },
        ratios: { TWD: 1, USD: 0 }
      }
    ]
  }
];

afterEach(() => {
  cleanup();
});

describe('SpenderAnalysis onSelectCategory', () => {
  it('點成員的分類列，帶出分類、成員與月份', () => {
    const onSelect = vi.fn();
    render(<SpenderAnalysis items={items} currencyFilter="all" yearMonth="2026-11" onSelectCategory={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '查看美老婆的居家生活明細' }));
    expect(onSelect).toHaveBeenCalledWith({
      categoryId: 'c1',
      categoryName: '居家生活',
      categoryIcon: '🏦',
      ownerId: 'u1',
      ownerName: '美老婆',
      yearMonth: '2026-11'
    });
  });

  it('未傳入時不渲染按鈕', () => {
    render(<SpenderAnalysis items={items} currencyFilter="all" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
