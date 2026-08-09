import { ChevronRight, PieChart } from 'lucide-react';
import { formatAmount } from '../../lib/currency';

interface DualCurrencyDisplayProps {
  title: string;
  values: { TWD: number; USD: number };
  /** 傳入時整張卡片可點（首頁用來開圓餅圖分析）；未傳入維持純顯示。 */
  onClick?: () => void;
}

function DisplayBody({ title, values, interactive }: DualCurrencyDisplayProps & { interactive: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {interactive ? (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-family">
            <PieChart className="h-3.5 w-3.5" aria-hidden="true" />
            圖表
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{formatAmount(values.TWD, 'TWD')}</p>
      {values.USD !== 0 ? (
        <p className="mt-1 text-xl font-semibold text-slate-700">{formatAmount(values.USD, 'USD')}</p>
      ) : null}
    </>
  );
}

export function DualCurrencyDisplay({ title, values, onClick }: DualCurrencyDisplayProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-family/50 hover:shadow-sm active:opacity-80"
      >
        <DisplayBody title={title} values={values} interactive />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <DisplayBody title={title} values={values} interactive={false} />
    </div>
  );
}
