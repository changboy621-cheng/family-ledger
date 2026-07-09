import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  /** 預設是否展開；未指定則收合（本 App 一律預設收合、有需要再打開）。 */
  defaultOpen?: boolean;
  subtitle?: string;
}

// 可收合區塊：標題列為一顆按鈕，點擊切換展開/收合；收合時內容不渲染（省效能）。
// 標題列本身是卡片外觀，內容區僅堆疊子卡片，避免卡中卡的雙重邊框。
export function CollapsibleSection({ title, children, defaultOpen = false, subtitle }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-bold text-slate-900">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs font-normal text-slate-400">{subtitle}</span> : null}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={panelId} className="grid gap-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
