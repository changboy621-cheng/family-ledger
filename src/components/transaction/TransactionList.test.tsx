// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TransactionList } from './TransactionList';

afterEach(cleanup);

describe('TransactionList 載入失敗狀態', () => {
  it('error 時顯示「載入失敗＋重試」，而非假裝「沒有交易」', () => {
    const onRetry = vi.fn();
    render(<TransactionList groupedTransactions={{}} loading={false} error onRetry={onRetry} />);

    expect(screen.getByText(/載入失敗/)).toBeTruthy();
    expect(screen.queryByText(/還沒有交易/)).toBeNull();

    fireEvent.click(screen.getByText('重試'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('載入中顯示載入提示', () => {
    render(<TransactionList groupedTransactions={{}} loading error={false} />);
    expect(screen.getByText(/載入交易中/)).toBeTruthy();
  });

  it('無 error 且確實沒有資料時，才顯示空狀態', () => {
    render(<TransactionList groupedTransactions={{}} loading={false} />);
    expect(screen.getByText(/還沒有交易/)).toBeTruthy();
  });
});
