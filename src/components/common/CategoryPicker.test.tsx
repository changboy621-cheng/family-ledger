// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category } from '../../types';
import { CategoryPicker } from './CategoryPicker';

afterEach(cleanup);

const categories: Category[] = [
  { id: 'c1', family_id: 'fam-1', name: '餐飲', icon: '🍽️', type: 'expense', is_shared: true, sort_order: 10 },
  { id: 'c2', family_id: 'fam-1', name: '交通', icon: '🚗', type: 'expense', is_shared: true, sort_order: 20 }
];

describe('CategoryPicker（下拉選單）', () => {
  it('以 select 列出所有類別，選取時回呼 onChange 帶類別 id', () => {
    const onChange = vi.fn();
    render(<CategoryPicker categories={categories} value="c1" onChange={onChange} />);

    const select = screen.getByLabelText('類別') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.querySelectorAll('option')).toHaveLength(2);
    expect(select.value).toBe('c1');

    fireEvent.change(select, { target: { value: 'c2' } });
    expect(onChange).toHaveBeenCalledWith('c2');
  });

  it('刪除已選類別：確認後呼叫 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoryPicker categories={categories} value="c1" onChange={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByRole('button', { name: /刪除/ }));
    fireEvent.click(screen.getByRole('button', { name: /確認刪除/ }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c1'));
  });

  it('類別已被帳目使用時，顯示 onDelete 丟出的錯誤訊息', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('此類別已有帳目使用，無法刪除'));
    render(
      <CategoryPicker categories={categories} value="c1" onChange={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByRole('button', { name: /刪除/ }));
    fireEvent.click(screen.getByRole('button', { name: /確認刪除/ }));

    await waitFor(() => expect(screen.getByText('此類別已有帳目使用，無法刪除')).toBeTruthy());
  });

  it('新增類別：填名稱後儲存呼叫 onCreate 並選取新類別', async () => {
    const created: Category = {
      id: 'c3',
      family_id: 'fam-1',
      name: '寵物',
      icon: '🐶',
      type: 'expense',
      is_shared: true,
      sort_order: 30
    };
    const onCreate = vi.fn().mockResolvedValue(created);
    const onChange = vi.fn();
    render(<CategoryPicker categories={categories} value="c1" onChange={onChange} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: /新增/ }));
    fireEvent.change(screen.getByPlaceholderText(/類別名稱/), { target: { value: '寵物' } });
    fireEvent.click(screen.getByRole('button', { name: '新增類別' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0]).toBe('寵物');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('c3'));
  });
});
