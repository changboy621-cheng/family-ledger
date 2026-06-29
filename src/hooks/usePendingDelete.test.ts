// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const showToast = vi.fn();
vi.mock('../store/uiStore', () => ({
  useUIStore: (selector: (s: { showToast: typeof showToast }) => unknown) => selector({ showToast })
}));

import { usePendingDelete, UNDO_WINDOW_MS } from './usePendingDelete';

// 取得最後一次「已刪除」toast 帶的復原 onAction。
function lastUndoAction(): () => void {
  const calls = showToast.mock.calls;
  const call = calls[calls.length - 1];
  return (call?.[2] as { onAction: () => void }).onAction;
}

describe('usePendingDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    showToast.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requestDelete 先樂觀隱藏，逾時後才真正 commit', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePendingDelete(commit));

    act(() => result.current.requestDelete('t1'));
    expect(result.current.pendingIds).toContain('t1');
    expect(commit).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS);
    });
    expect(commit).toHaveBeenCalledWith('t1');
  });

  it('5 秒視窗內按復原會取消 commit 並取消隱藏', () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePendingDelete(commit));

    act(() => result.current.requestDelete('t1'));
    act(() => lastUndoAction()());
    act(() => vi.advanceTimersByTime(UNDO_WINDOW_MS * 2));

    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pendingIds).not.toContain('t1');
  });

  it('卸載時把仍在等待視窗內的刪除立即送出（避免遺失）', () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => usePendingDelete(commit));

    act(() => result.current.requestDelete('t1'));
    unmount();
    expect(commit).toHaveBeenCalledWith('t1');
  });

  it('commit 失敗時取消隱藏並提示錯誤訊息', async () => {
    const commit = vi.fn().mockRejectedValue(new Error('刪除被 RLS 擋下'));
    const { result } = renderHook(() => usePendingDelete(commit));

    act(() => result.current.requestDelete('t1'));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.pendingIds).not.toContain('t1');
    expect(showToast).toHaveBeenCalledWith('刪除被 RLS 擋下', 'error');
  });

  it('同一筆重複 requestDelete 不會排入兩次，也不會 commit 兩次（避免重複刪除）', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePendingDelete(commit));

    act(() => {
      result.current.requestDelete('t1');
      result.current.requestDelete('t1');
    });
    expect(result.current.pendingIds.filter((id) => id === 't1')).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('重複 requestDelete 後按復原，不應有殘留 timer 仍偷偷 commit', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePendingDelete(commit));

    act(() => {
      result.current.requestDelete('t1');
      result.current.requestDelete('t1');
    });
    act(() => lastUndoAction()());

    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    });
    expect(commit).not.toHaveBeenCalled();
  });
});
