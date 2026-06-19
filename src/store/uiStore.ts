import { create } from 'zustand';

type ToastTone = 'success' | 'error';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastState {
  message: string;
  tone: ToastTone;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
  duration: number;
}

interface UIState {
  toast: ToastState;
  showToast: (message: string, tone?: ToastTone, options?: ToastOptions) => void;
  hideToast: () => void;
}

const DEFAULT_DURATION = 2400;

export const useUIStore = create<UIState>((set) => ({
  toast: {
    message: '',
    tone: 'success',
    visible: false,
    duration: DEFAULT_DURATION
  },
  showToast: (message, tone = 'success', options) =>
    set({
      toast: {
        message,
        tone,
        visible: true,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        duration: options?.duration ?? DEFAULT_DURATION
      }
    }),
  hideToast: () =>
    set((state) => ({
      toast: {
        ...state.toast,
        visible: false,
        actionLabel: undefined,
        onAction: undefined
      }
    }))
}));
