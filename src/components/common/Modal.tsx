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
    // preventScroll：iOS 上程式化 focus 會把元素捲進可視區，導致固定浮層位移、
    // 畫面比例看似變調、點擊座標對不上（連續記帳時特別明顯），故禁止此捲動。
    const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus({ preventScroll: true });

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

  // 開啟期間鎖住背景捲動：避免對話框內的捲動「串接」到底層頁面，
  // 讓頁面在關閉後停在偏移位置，害下一次開窗的固定浮層錯位、無法點擊。
  // 記錄開窗當下的捲動位置，關閉時原封還原，過程中不讓畫面跳動。
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      // 還原捲動位置（jsdom 的 scrollTo 為未實作的樁，故以 try 包住）。
      try {
        window.scrollTo(0, scrollY);
      } catch {
        // 測試環境無真正的捲動，忽略即可。
      }
    };
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
