// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NoteDefaults } from '../../lib/suggestions';

// jsdom 沒有 PointerEvent 建構子，@testing-library 的 fireEvent.pointerDown 會退回
// 用 window.Event 建立事件，導致 pointerType 屬性沒被帶上；手動組一個帶 pointerType 的
// 事件物件再 dispatch，讓 React 的合成事件能讀到 event.pointerType === 'touch'。
function firePointerDown(element: Element, pointerType: string) {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType, configurable: true });
  fireEvent(element, event);
}

// 餐飲用過「星巴克」「午餐」；交通用過「加油」「午餐」（同一備註在不同分類，金額各自記住）。
const noteDefaults = new Map<string, NoteDefaults>([
  ['星巴克', { category_id: 'c-food', amount: 150, currency: 'TWD', payment_method: 'card' }],
  ['加油', { category_id: 'c-car', amount: 1200, currency: 'TWD', payment_method: 'card' }],
  ['午餐', { category_id: 'c-food', amount: 120, currency: 'TWD', payment_method: 'cash' }]
]);
const notesByCategory = new Map<string, string[]>([
  ['c-food', ['星巴克', '午餐']],
  ['c-car', ['加油', '午餐']]
]);
const categoryNoteDefaults = new Map<string, NoteDefaults>([
  ['c-food\u0000星巴克', { category_id: 'c-food', amount: 150, currency: 'TWD', payment_method: 'card' }],
  ['c-food\u0000午餐', { category_id: 'c-food', amount: 120, currency: 'TWD', payment_method: 'cash' }],
  ['c-car\u0000加油', { category_id: 'c-car', amount: 1200, currency: 'TWD', payment_method: 'card' }],
  ['c-car\u0000午餐', { category_id: 'c-car', amount: 80, currency: 'TWD', payment_method: 'cash' }]
]);
vi.mock('../../hooks/useEntrySuggestions', () => ({
  useEntrySuggestions: () => ({
    noteHistory: ['星巴克', '加油', '午餐'],
    noteDefaults,
    notesByCategory,
    categoryNoteDefaults
  })
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

describe('備註跟著分類', () => {
  const noteInput = () => screen.getByPlaceholderText('晚餐、機票、生活用品...');
  const chip = (name: string) => screen.queryByRole('button', { name });

  it('只列目前分類用過的備註，切換分類就換一組', () => {
    renderForm();
    expect(chip('星巴克')).toBeInTheDocument();
    expect(chip('加油')).toBeNull();

    fireEvent.change(screen.getByLabelText('類別'), { target: { value: 'c-car' } });
    expect(chip('加油')).toBeInTheDocument();
    expect(chip('星巴克')).toBeNull();
  });

  it('同一備註在不同分類，帶入的是該分類的金額，且不切換分類', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('類別'), { target: { value: 'c-car' } });
    fireEvent.click(screen.getByRole('button', { name: '午餐' }));
    expect(noteInput()).toHaveValue('午餐');
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByLabelText('類別')).toHaveValue('c-car');
  });

  it('輸入文字時補上其他分類的相符備註，點了切換到該分類', () => {
    renderForm();
    fireEvent.change(noteInput(), { target: { value: '加' } });
    fireEvent.click(screen.getByRole('button', { name: '加油' }));
    expect(screen.getByLabelText('類別')).toHaveValue('c-car');
    expect(screen.getByText('1200')).toBeInTheDocument();
  });

  it('釘選的備註只出現在用過它的分類', () => {
    localStorage.setItem('fl:pinned-notes:family:expense', JSON.stringify(['加油']));
    renderForm();
    expect(chip('📌 加油')).toBeNull();
    fireEvent.change(screen.getByLabelText('類別'), { target: { value: 'c-car' } });
    expect(screen.getByRole('button', { name: /📌.*加油/ })).toBeInTheDocument();
  });
});

describe('釘選', () => {
  it('右鍵（contextmenu）釘選後圓籤帶 📌 並寫入 localStorage', () => {
    renderForm();
    fireEvent.contextMenu(screen.getByRole('button', { name: '午餐' }));
    expect(screen.getByRole('button', { name: /📌.*午餐/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('fl:pinned-notes:family:expense') ?? '[]')).toEqual(['午餐']);
  });
});

describe('觸控長按釘選', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('長按 500ms 觸發釘選；同一顆圓籤緊接著的 click 被抑制、不帶入', () => {
    renderForm();
    const chip = screen.getByRole('button', { name: '星巴克' });
    firePointerDown(chip, 'touch');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('button', { name: /📌.*星巴克/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('fl:pinned-notes:family:expense') ?? '[]')).toEqual(['星巴克']);

    fireEvent.click(screen.getByRole('button', { name: /📌.*星巴克/ }));
    expect(screen.getByPlaceholderText('晚餐、機票、生活用品...')).toHaveValue('');
  });

  it('迴歸：firedFor 應綁定觸發長按的圓籤，不會讓另一顆圓籤的下一次點擊被誤吃', () => {
    renderForm();
    const chipA = screen.getByRole('button', { name: '星巴克' });
    firePointerDown(chipA, 'touch');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // 刻意不點 chipA（模擬 iOS 原生選字選單吃掉了長按後的合成 click）；
    // 若用單一布林值 fired，這裡殘留的 true 會讓下面對「另一顆」圓籤的點擊也被吃掉。
    const chipB = screen.getByRole('button', { name: '午餐' });
    fireEvent.click(chipB);
    expect(screen.getByPlaceholderText('晚餐、機票、生活用品...')).toHaveValue('午餐');
  });

  it('表單在長按計時器觸發前卸載：計時器被清除，不寫入 localStorage、不拋錯', () => {
    const { unmount } = renderForm();
    const chip = screen.getByRole('button', { name: '星巴克' });
    firePointerDown(chip, 'touch');
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).not.toThrow();
    expect(localStorage.getItem('fl:pinned-notes:family:expense')).toBeNull();
  });
});
