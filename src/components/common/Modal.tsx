import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  /** 給螢幕報讀器的對話框名稱（aria-label）。 */
  title: string;
  children: ReactNode;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// 可重用的對話框外殼：role=dialog / aria-modal、開啟時移入焦點、focus trap、
// Esc 與點背景關閉。讓鍵盤與螢幕報讀器使用者也能正常操作 modal。
export function Modal({ onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 用 ref 持有最新 onClose，讓 effect 維持 mount-only，
  // 避免父層（LedgerPage/Dashboard）以 inline onClose 重繪時重跑初始聚焦、把焦點搶回第一欄。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    // 開啟時把焦點移入對話框（第一個可聚焦元素，否則對話框本身）。
    const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => !element.hasAttribute('disabled')
      );
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      // 在邊界時環繞，避免 Tab 跑到對話框後面的頁面。
      if (event.shiftKey && active === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // mount-only：初始聚焦只做一次；Esc 透過 onCloseRef 取得最新 handler（故 deps 為空）。
  }, []);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/40 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="mx-auto max-w-3xl rounded-xl bg-white p-5 shadow-xl outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
