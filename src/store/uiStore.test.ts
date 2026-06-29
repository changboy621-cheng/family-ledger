import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore toast queue', () => {
  beforeEach(() => useUIStore.setState({ toasts: [] }));

  it('多個 toast 並存，後續訊息不會吃掉「復原」按鈕', () => {
    const onAction = vi.fn();
    useUIStore.getState().showToast('已刪除', 'success', { actionLabel: '復原', onAction, duration: 5000 });
    useUIStore.getState().showToast('交易已新增');

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    const undo = toasts.find((toast) => toast.actionLabel === '復原');
    expect(undo).toBeDefined();
    expect(undo?.duration).toBe(5000);
  });

  it('dismissToast 只移除指定 id', () => {
    useUIStore.getState().showToast('A');
    useUIStore.getState().showToast('B');
    const [first, second] = useUIStore.getState().toasts;

    useUIStore.getState().dismissToast(first.id);
    const remaining = useUIStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
    expect(remaining[0].message).toBe('B');
  });

  it('同時最多保留 3 個，超過丟最舊的（皆非可操作時）', () => {
    for (let i = 1; i <= 5; i += 1) useUIStore.getState().showToast(`t${i}`);
    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts.map((toast) => toast.message)).toEqual(['t3', 't4', 't5']);
  });

  it('超過上限時優先保留含復原動作的 toast（不在 undo 視窗內被擠掉）', () => {
    useUIStore.getState().showToast('已刪除', 'success', { actionLabel: '復原', onAction: vi.fn(), duration: 5000 });
    for (let i = 1; i <= 4; i += 1) useUIStore.getState().showToast(`t${i}`);

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts.some((toast) => toast.actionLabel === '復原')).toBe(true);
  });
});
