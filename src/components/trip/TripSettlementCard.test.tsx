// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { settleByCategory, settleByMember, type TripExpense } from '../../lib/trips';
import { TripSettlementCard } from './TripSettlementCard';

afterEach(cleanup);

function expense(overrides: Partial<TripExpense>): TripExpense {
  return {
    id: 'e',
    trip_id: 't',
    family_id: 'f',
    expense_date: '2026-11-02',
    amount: 10000,
    currency: 'JPY',
    rate: 0.21,
    category: 'food',
    ...overrides
  };
}

const names: Record<string, string> = { mack: 'Mack', mina: 'Mina' };
const memberName = (id: string | null | undefined) => (id ? names[id] ?? '' : '');

describe('TripSettlementCard', () => {
  it('每人刷卡、現金分開，代墊另列，並給平分建議', () => {
    const rows = [
      expense({ id: 'a', paid_by: 'mack', payment_method: 'card' }),
      expense({
        id: 'b',
        paid_by: 'mina',
        payment_method: 'cash',
        amount: 4000,
        friend_shares: [{ id: 's', name: '阿明', amount: 2000, repaid_at: null, repaid_method: null }]
      })
    ];
    render(
      <TripSettlementCard
        settlement={settleByMember(rows)}
        categories={settleByCategory(rows)}
        memberIds={['mack', 'mina']}
        memberName={memberName}
      />
    );

    expect(screen.getAllByText('Mack')).toHaveLength(2); // 結算列＋平分建議
    // 分類加總：餐飲 = 2100 + 420（代墊 420 不算），誰付的與刷卡現金分開
    expect(screen.getByText('依分類')).toBeInTheDocument();
    expect(screen.getByText('🍜 餐飲').nextSibling).toHaveTextContent('NT$2,520');
    expect(screen.getByText('Mack NT$2,100・Mina NT$420')).toBeInTheDocument();
    expect(screen.getByText('💳 NT$2,100・💵 NT$420')).toBeInTheDocument();
    expect(screen.getByText('共付出 NT$840，其中幫朋友代墊 NT$420')).toBeInTheDocument();
    expect(screen.getByText('刷卡合計').nextSibling).toHaveTextContent('NT$2,100');
    expect(screen.getByText('現金合計').nextSibling).toHaveTextContent('NT$840');
    expect(screen.getByText('這趟實際花費').nextSibling).toHaveTextContent('NT$2,520');
    expect(screen.getByText(/如果兩人平分/)).toHaveTextContent('如果兩人平分：Mina 給 Mack NT$840');
  });

  it('沒記付款人的花費顯示「未記付款人」且不給平分建議', () => {
    render(
      <TripSettlementCard
        settlement={settleByMember([expense({ paid_by: null })])}
        categories={settleByCategory([expense({ paid_by: null })])}
        memberIds={['mack', 'mina']}
        memberName={memberName}
      />
    );
    expect(screen.getByText('未記付款人')).toBeInTheDocument();
    expect(screen.queryByText(/如果兩人平分/)).toBeNull();
  });
});
