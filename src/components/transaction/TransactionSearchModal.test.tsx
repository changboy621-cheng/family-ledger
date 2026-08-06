// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Transaction } from '../../types';

const searchState = {
  results: [] as Transaction[],
  loading: false,
  error: false,
  refetch: vi.fn()
};
vi.mock('../../hooks/useTransactionSearch', () => ({
  useTransactionSearch: vi.fn(() => searchState)
}));
vi.mock('../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({ members: [], loading: false })
}));
vi.mock('../../hooks/useEntrySuggestions', () => ({
  useEntrySuggestions: () => ({ noteHistory: [], noteDefaults: new Map() })
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [],
    loading: false,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn()
  })
}));

import { useReferenceStore } from '../../store/referenceStore';
import { useAuthStore } from '../../store/authStore';
import { TransactionSearchModal } from './TransactionSearchModal';

const tx = (overrides: Partial<Transaction>): Transaction =>
  ({
    id: 'id',
    family_id: 'fam1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 100,
    currency: 'TWD',
    category_id: 'c1',
    note: '機票 東京',
    transaction_date: '2026-07-12',
    created_at: '2026-07-12T00:00:00Z',
    updated_at: '2026-07-12T00:00:00Z',
    category: { id: 'c1', name: '旅遊', icon: '✈️', type: 'expense', is_shared: true },
    ...overrides
  } as Transaction);

const noop = async () => {};

function renderModal(props: Partial<Parameters<typeof TransactionSearchModal>[0]> = {}) {
  return render(
    <TransactionSearchModal ledgerType="family" onClose={vi.fn()} onUpdate={noop} onDelete={noop} {...props} />
  );
}

// 搜尋框輸入採 300ms debounce 才觸發查詢（見元件內 DEBOUNCE_MS），
// 這裡用假時鐘模擬「打完字停頓」，讓測試貼近真實使用情境而非改動元件行為。
function typeKeyword(value: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  searchState.results = [];
  searchState.loading = false;
  searchState.error = false;
  localStorage.clear();
  useAuthStore.setState({
    profile: { id: 'u1', family_id: 'fam1', display_name: '我', avatar_color: '#000', default_currency: 'TWD' }
  });
  useReferenceStore.setState({ categories: [] });
});

describe('搜尋模式', () => {
  it('輸入為空時顯示最近搜尋圓籤，點了帶入輸入框', () => {
    localStorage.setItem('fl:recent-searches:family', JSON.stringify(['機票', '全聯']));
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '機票' }));
    expect(screen.getByRole('searchbox')).toHaveValue('機票');
  });

  it('有結果時顯示總計與月份分組小計', () => {
    searchState.results = [
      tx({ id: 'a', transaction_date: '2026-07-12', amount: 28400 }),
      tx({ id: 'b', transaction_date: '2026-02-03', amount: 16800 })
    ];
    renderModal();
    typeKeyword('機票');
    expect(screen.getByText(/共 2 筆/)).toBeInTheDocument();
    expect(screen.getByText('2026年7月')).toBeInTheDocument();
    expect(screen.getByText('2026年2月')).toBeInTheDocument();
  });

  it('篩選圓籤可縮小結果（型別）', () => {
    searchState.results = [
      tx({ id: 'a', type: 'expense', note: '機票 東京' }),
      tx({ id: 'b', type: 'income', note: '退機票' })
    ];
    renderModal();
    typeKeyword('機票');
    fireEvent.click(screen.getByRole('button', { name: '收入' }));
    expect(screen.getByText(/共 1 筆/)).toBeInTheDocument();
  });

  it('無結果時顯示空狀態', () => {
    searchState.results = [];
    renderModal();
    typeKeyword('xyz');
    expect(screen.getByText(/找不到符合/)).toBeInTheDocument();
  });

  it('搜尋失敗顯示錯誤與重試', () => {
    searchState.error = true;
    renderModal();
    typeKeyword('機票');
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(searchState.refetch).toHaveBeenCalled();
  });
});

describe('分類模式', () => {
  const categoryProps = {
    category: { categoryId: 'c1', categoryName: '旅遊', categoryIcon: '✈️' }
  };

  it('顯示分類標題、無搜尋框、有期間篩選', () => {
    searchState.results = [tx({ id: 'a' })];
    renderModal(categoryProps);
    // 分類標題與清單項目都會顯示「旅遊」文字，用 heading role 鎖定標題本身。
    expect(screen.getByRole('heading', { name: /旅遊/ })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: '近3個月' })).toBeInTheDocument();
  });

  it('期間篩選過濾結果', () => {
    searchState.results = [
      tx({ id: 'recent', transaction_date: new Date().toISOString().slice(0, 10) }),
      tx({ id: 'old', transaction_date: '2020-01-01' })
    ];
    renderModal(categoryProps);
    expect(screen.getByText(/共 2 筆/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '近3個月' }));
    expect(screen.getByText(/共 1 筆/)).toBeInTheDocument();
  });
});
