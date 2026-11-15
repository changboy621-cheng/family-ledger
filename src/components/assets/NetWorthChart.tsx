import { formatAmount } from '../../lib/currency';
import type { Currency } from '../../types';

interface NetWorthChartProps {
  points: { month: string; value: number }[];
  currency: Currency;
}

/** 淨資產走勢：每月月底的淨資產長條圖；負值往下長、以紅色表示。 */
export function NetWorthChart({ points, currency }: NetWorthChartProps) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  const hasNegative = points.some((point) => point.value < 0);
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const change = last - first;

  return (
    <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold text-slate-900">淨資產走勢</h2>
        <p className={`text-sm font-semibold ${change >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          近 {points.length} 個月 {change >= 0 ? '+' : '−'}
          {formatAmount(Math.abs(change), currency)}
        </p>
      </div>
      <div className={`mt-5 grid h-36 items-stretch gap-1.5`} style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => {
          const ratio = Math.abs(point.value) / max;
          const isLast = index === points.length - 1;
          return (
            <div key={point.month} className={`flex flex-col ${hasNegative ? '' : 'justify-end'}`} title={`${point.month}：${formatAmount(point.value, currency)}`}>
              {hasNegative ? (
                <>
                  <div className="flex flex-1 items-end">
                    {point.value >= 0 ? <div className={`w-full rounded-t ${isLast ? 'bg-slate-900' : 'bg-slate-400'}`} style={{ height: `${ratio * 100}%` }} /> : null}
                  </div>
                  <div className="flex flex-1 items-start border-t border-slate-300">
                    {point.value < 0 ? <div className="w-full rounded-b bg-red-400" style={{ height: `${ratio * 100}%` }} /> : null}
                  </div>
                </>
              ) : (
                <div className={`w-full rounded-t ${isLast ? 'bg-slate-900' : 'bg-slate-400'}`} style={{ height: `${Math.max(ratio * 100, 2)}%` }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-1.5 text-center text-[11px] text-slate-500" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => (
          <span key={point.month}>{index % 2 === points.length % 2 || index === points.length - 1 ? Number(point.month.slice(5)) + '月' : ''}</span>
        ))}
      </div>
    </section>
  );
}
