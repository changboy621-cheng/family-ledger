import { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

export function Toast() {
  const toast = useUIStore((state) => state.toast);
  const hideToast = useUIStore((state) => state.hideToast);

  useEffect(() => {
    if (!toast.visible) return undefined;

    const timer = window.setTimeout(() => {
      hideToast();
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [hideToast, toast.visible, toast.message]);

  if (!toast.visible) return null;

  const isSuccess = toast.tone === 'success';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div
        className={`flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
          isSuccess ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
        }`}
        role="status"
        aria-live="polite"
      >
        {isSuccess ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
