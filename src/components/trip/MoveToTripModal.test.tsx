// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Transaction } from '../../types';

const trip = {
  id: 't-oita',
  family_id: 'f',
  name: '大分親子遊',
  start_date: '2026-10-18',
  end_date: '2026-10-22',
  local_currency: 'JPY',
  rate: 0.21
};
const addExpense = vi.fn().mockResolvedValue(undefined);
vi.mock('../../hooks/useTrips', () => ({
  useTrips: () => ({ trips: [trip], loading: false }),
  useTripDetail: () => ({ trip, expenses: [], cashExchanges: [], loading: false, addExpense })
}));
vi.mock('../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({ members: [{ id: 'u-mack', display_name: '帥老公' }], loading: false })
}));

import { MoveToTripModal } from './MoveToTripModal';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const transaction: Transaction = {
  id: 'tx-1',
  family_id: 'f',
  owner_id: 'u-mack',
  ledger_type: 'personal',
  type: 'expense',
  amount: 1900,
  currency: 'TWD',
  category_id: 'c-food',
  category: { id: 'c-food', name: '餐飲食品', icon: '🍺', type: 'expense', is_shared: true },
  note: '檸檬soda',
  payment_method: 'cash',
  transaction_date: '2026-10-20',
  latitude: 33.26,
  longitude: 131.36,
  place_name: '湯之坪街道・由布市・日本',
  created_at: '',
  updated_at: ''
};

describe('MoveToTripModal', () => {
  it('改成日圓後搬到旅行：金額數字不變、座標與地點帶過去，再刪掉原本那筆', async () => {
    const onDeleteOriginal = vi.fn().mockResolvedValue(undefined);
    const onMoved = vi.fn();
    render(
      <MemoryRouter>
        <MoveToTripModal transaction={transaction} onDeleteOriginal={onDeleteOriginal} onMoved={onMoved} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText(/原本記成/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'JPY' }));
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));

    await waitFor(() => expect(onDeleteOriginal).toHaveBeenCalledWith('tx-1'));
    expect(addExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        expense_date: '2026-10-20',
        amount: 1900,
        currency: 'JPY',
        rate: 0.21,
        category: 'food',
        payment_method: 'cash',
        note: '檸檬soda',
        paid_by: 'u-mack',
        latitude: 33.26,
        longitude: 131.36,
        place_name: '湯之坪街道・由布市・日本'
      })
    );
    expect(addExpense.mock.invocationCallOrder[0]).toBeLessThan(onDeleteOriginal.mock.invocationCallOrder[0]);
    expect(onMoved).toHaveBeenCalled();
  });

  it('旅行那筆存失敗時不刪原本那筆', async () => {
    addExpense.mockRejectedValueOnce(new Error('network'));
    const onDeleteOriginal = vi.fn();
    render(
      <MemoryRouter>
        <MoveToTripModal transaction={transaction} onDeleteOriginal={onDeleteOriginal} onClose={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await waitFor(() => expect(addExpense).toHaveBeenCalled());
    expect(onDeleteOriginal).not.toHaveBeenCalled();
  });
});
