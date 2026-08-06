// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NoteDefaults } from '../../lib/suggestions';

const noteDefaults = new Map<string, NoteDefaults>([
  ['星巴克', { category_id: 'c-food', amount: 150, currency: 'TWD', payment_method: 'card' }]
]);
vi.mock('../../hooks/useEntrySuggestions', () => ({
  useEntrySuggestions: () => ({ noteHistory: ['星巴克', '加油'], noteDefaults })
}));
vi.mock('../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({ members: [], loading: false })
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [
      { id: 'c-food', name: '餐飲', icon: '🍜', type: 'expense', is_shared: true },
      { id: 'c-car', name: '交通', icon: '🚗', type: 'expense', is_shared: true }
    ],
    loading: false,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn()
  })
}));

import { useAuthStore } from '../../store/authStore';
import { TransactionForm } from './TransactionForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    profile: { id: 'u1', family_id: 'fam1', display_name: '我', avatar_color: '#000', default_currency: 'TWD' }
  });
});

function renderForm() {
  return render(
    <TransactionForm initialLedgerType="family" onSubmit={vi.fn(async () => {})} onClose={vi.fn()} />
  );
}

// AmountInput 沒有真正的 <input>，金額顯示在計算機式面板的 <p> 裡，
// 且用數字鍵盤（aria-label 為數字本身）輸入；故不用 getByDisplayValue，改用文字內容/按鍵。
describe('聰明帶入', () => {
  it('點備註圓籤帶入備註＋分類＋付款方式；金額空白時帶入金額', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '星巴克' }));
    expect(screen.getByPlaceholderText('晚餐、機票、生活用品...')).toHaveValue('星巴克');
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('金額已輸入時不覆蓋', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(screen.getByText('999')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '星巴克' }));
    expect(screen.getByText('999')).toBeInTheDocument();
  });
});

describe('釘選', () => {
  it('右鍵（contextmenu）釘選後圓籤帶 📌 並寫入 localStorage', () => {
    renderForm();
    fireEvent.contextMenu(screen.getByRole('button', { name: '加油' }));
    expect(screen.getByRole('button', { name: /📌.*加油/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('fl:pinned-notes:family:expense') ?? '[]')).toEqual(['加油']);
  });
});
