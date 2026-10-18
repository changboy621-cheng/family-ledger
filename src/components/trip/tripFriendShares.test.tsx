// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ShareDraft } from '../../lib/tripShareDrafts';
import { friendDebts, type TripExpense } from '../../lib/trips';
import { TripFriendSharesField } from './TripFriendSharesField';
import { TripFriendDebtsCard } from './TripFriendDebtsCard';

afterEach(cleanup);

function Harness({ total = 3000, knownNames = ['阿明'] }: { total?: number; knownNames?: string[] }) {
  const [drafts, setDrafts] = useState<ShareDraft[]>([]);
  return (
    <TripFriendSharesField drafts={drafts} onChange={setDrafts} currency="JPY" totalAmount={total} rate={0.21} knownNames={knownNames} />
  );
}

describe('TripFriendSharesField', () => {
  it('第一位預設帶全額；再加一位帶剩下的金額；顯示自己負擔', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /幫朋友代墊/ }));
    expect(screen.getByLabelText('朋友代墊金額')).toHaveValue('3000');
    expect(screen.getByText(/我們自己負擔 JPY 0/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('朋友代墊金額'), { target: { value: '1000' } });
    expect(screen.getByText('我們自己負擔 JPY 2,000（≈NT$420）')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '＋ 阿明' }));
    expect(screen.getAllByLabelText('朋友名字')[1]).toHaveValue('阿明');
    expect(screen.getByLabelText('阿明代墊金額')).toHaveValue('2000');
  });

  it('代墊超過花費時提示', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /幫朋友代墊/ }));
    fireEvent.change(screen.getByLabelText('朋友代墊金額'), { target: { value: '5000' } });
    expect(screen.getByText('代墊合計超過這筆花費了')).toBeInTheDocument();
  });
});

function expense(overrides: Partial<TripExpense>): TripExpense {
  return {
    id: 'e1',
    trip_id: 't',
    family_id: 'f',
    expense_date: '2026-11-02',
    amount: 3000,
    currency: 'JPY',
    rate: 0.21,
    category: 'food',
    note: '燒肉',
    ...overrides
  };
}

describe('TripFriendDebtsCard', () => {
  const expenses = [
    expense({
      friend_shares: [
        { id: 's1', name: '阿明', amount: 1000, repaid_at: null, repaid_method: null },
        { id: 's2', name: '小華', amount: 500, repaid_at: '2026-11-03', repaid_method: 'transfer' }
      ]
    })
  ];

  it('列出未還，點「收到了」選現金', async () => {
    const onRepaid = vi.fn(async () => {});
    render(<TripFriendDebtsCard debts={friendDebts(expenses)} onRepaid={onRepaid} />);
    expect(screen.getByText('還沒還 NT$210')).toBeInTheDocument();
    expect(screen.getByText('阿明')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '收到了' }));
    fireEvent.click(screen.getByRole('button', { name: '現金' }));
    expect(onRepaid).toHaveBeenCalledWith(expect.objectContaining({ share: expect.objectContaining({ id: 's1' }) }), 'cash');
  });

  it('已還的收起來，展開可改回未還', () => {
    const onRepaid = vi.fn(async () => {});
    render(<TripFriendDebtsCard debts={friendDebts(expenses)} onRepaid={onRepaid} />);
    fireEvent.click(screen.getByRole('button', { name: /已還 NT\$105/ }));
    fireEvent.click(screen.getByRole('button', { name: '改回未還' }));
    expect(onRepaid).toHaveBeenCalledWith(expect.objectContaining({ share: expect.objectContaining({ id: 's2' }) }), null);
  });

  it('全部還清時顯示', () => {
    render(
      <TripFriendDebtsCard
        debts={friendDebts([expense({ friend_shares: [{ id: 's', name: '阿明', amount: 100, repaid_at: '2026-11-03', repaid_method: 'cash' }] })])}
        onRepaid={vi.fn()}
      />
    );
    expect(screen.getByText('都還清了 🎉')).toBeInTheDocument();
  });
});
