import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store/uiStore';

export const UNDO_WINDOW_MS = 5000;

// 刪除＋可復原：點刪除後先把項目「樂觀隱藏」，5 秒內可按復原取消；
// 逾時或離開頁面才真正送出刪除（commit）。避免重新插回資料庫的複雜度。
export function usePendingDelete(commit: (id: string) => Promise<void>) {
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const showToast = useUIStore((state) => state.showToast);

  // 用 ref 保存最新 commit，讓「卸載時把未完成的刪除送出」的 effect 維持穩定、不會因 commit 變動而提前觸發。
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const commitNow = useCallback(
    async (id: string) => {
      clearTimer(id);
      try {
        await commitRef.current(id);
        setPendingIds((current) => current.filter((pendingId) => pendingId !== id));
      } catch (error) {
        // 真刪失敗：取消隱藏讓項目復現，並提示
        setPendingIds((current) => current.filter((pendingId) => pendingId !== id));
        showToast(error instanceof Error ? error.message : '刪除失敗，請稍後再試。', 'error');
      }
    },
    [clearTimer, showToast]
  );

  const undo = useCallback(
    (id: string) => {
      clearTimer(id);
      setPendingIds((current) => current.filter((pendingId) => pendingId !== id));
      showToast('已復原');
    },
    [clearTimer, showToast]
  );

  const requestDelete = useCallback(
    (id: string) => {
      setPendingIds((current) => (current.includes(id) ? current : [...current, id]));
      const timer = window.setTimeout(() => void commitNow(id), UNDO_WINDOW_MS);
      timers.current.set(id, timer);
      showToast('已刪除', 'success', {
        actionLabel: '復原',
        onAction: () => undo(id),
        duration: UNDO_WINDOW_MS
      });
    },
    [commitNow, undo, showToast]
  );

  // 卸載（離開頁面）時，把仍在等待視窗內的刪除立即送出，避免遺失。
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach((timer, id) => {
        window.clearTimeout(timer);
        void commitRef.current(id);
      });
      pendingTimers.clear();
    };
  }, []);

  return { pendingIds, requestDelete };
}
