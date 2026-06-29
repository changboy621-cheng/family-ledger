import { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useUIStore, type ToastItem } from '../../store/uiStore';

function ToastRow({ toast }: { toast: ToastItem }) {
  const dismissToast = useUIStore((state) => state.dismissToast);

  useEffect(() => {
    // 每個 toast 各自計時，互不干擾（dismissToast 是穩定的 zustand action）。
    const timer = window.setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast.id, toast.duration]);

  const isSuccess = toast.tone === 'success';

  function handleAction() {
    // 先移除本 toast 再執行 callback：callback 可能 showToast（如復原會顯示「已復原」），
    // 先騰出空位可避免佇列已滿時誤淘汰其他訊息。
    dismissToast(toast.id);
    toast.onAction?.();
  }

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
        isSuccess ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
      }`}
      role="status"
      aria-live="polite"
    >
      {isSuccess ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      {toast.actionLabel ? (
        <button
          type="button"
          onClick={handleAction}
          className="shrink-0 rounded-lg bg-white/15 px-3 py-1 text-sm font-semibold hover:bg-white/25"
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Toast() {
  const toasts = useUIStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
