import { create } from 'zustand';

type ToastTone = 'success' | 'error';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  duration: number;
}

interface UIState {
  toasts: ToastItem[];
  showToast: (message: string, tone?: ToastTone, options?: ToastOptions) => void;
  dismissToast: (id: number) => void;
  /** 交易資料在清單以外被改動（例如固定收支自動記入）時遞增，讓各交易清單重抓。 */
  dataVersion: number;
  bumpDataVersion: () => void;
}

const DEFAULT_DURATION = 2400;
const MAX_TOASTS = 3; // 同時最多顯示 3 個，避免洗版

let nextToastId = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  // 改為 queue：新 toast 不再覆蓋舊的，避免後續訊息把「復原」按鈕（undo 視窗）吃掉。
  showToast: (message, tone = 'success', options) =>
    set((state) => {
      const next: ToastItem[] = [
        ...state.toasts,
        {
          id: (nextToastId += 1),
          message,
          tone,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
          duration: options?.duration ?? DEFAULT_DURATION
        }
      ];
      if (next.length <= MAX_TOASTS) return { toasts: next };

      // 超過上限：優先淘汰最舊的「非可操作」toast，保留含復原等動作的 toast（否則仍會吃掉 undo）。
      const removableIndex = next.findIndex((toast) => !toast.onAction);
      if (removableIndex === -1) return { toasts: next.slice(1) };
      next.splice(removableIndex, 1);
      return { toasts: next };
    }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  dataVersion: 0,
  bumpDataVersion: () => set((state) => ({ dataVersion: state.dataVersion + 1 }))
}));
