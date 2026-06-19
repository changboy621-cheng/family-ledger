import { create } from 'zustand';

type ToastTone = 'success' | 'error';

interface ToastState {
  message: string;
  tone: ToastTone;
  visible: boolean;
}

interface UIState {
  toast: ToastState;
  showToast: (message: string, tone?: ToastTone) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: {
    message: '',
    tone: 'success',
    visible: false
  },
  showToast: (message, tone = 'success') =>
    set({
      toast: {
        message,
        tone,
        visible: true
      }
    }),
  hideToast: () =>
    set((state) => ({
      toast: {
        ...state.toast,
        visible: false
      }
    }))
}));
