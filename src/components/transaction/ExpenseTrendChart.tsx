import { memo } from 'react';
import { formatAmount } from '../../lib/currency';
import { visibleCurrencies } from '../../lib/summaryView';
import type { Currency, DailyExpensePoint, MonthlyExpensePoint } from '../../types';

interface ExpenseTrendChartProps {
  title: string;
  points: DailyExpensePoint[] | MonthlyExpensePoint[];
  currencyFilter: Currency | 'all';
  labelKey: 'day' | 'label';
}

function getLabel(point: DailyExpensePoint | MonthlyExpensePoint, labelKey: 'day' | 'label') {
  return labelKey === 'day' ? `${(point as DailyExpensePoint).day}` : (point as MonthlyExpensePoint).label;
}

// 每日標籤太密時稀疏顯示：每 5 天、第一天與最後一天才標字。
function shouldShowLabel(point: DailyExpensePoint | MonthlyExpensePoint, index: number, total: number, labelKey: 'day' | 'label') {
  if (labelKey === 'label') return true;
  const day = (point as DailyExpensePoint).day;
  return day === 1 || day % 5 === 0 || index === total - 1;
}

function ExpenseTrendChartBase({ title, points, currencyFilter, labelKey }: ExpenseTrendChartProps) {
  const currencies = visibleCurrencies(currencyFilter);
  const hasData = points.some((point) => currencies.some((currency) => point.totals[currency] > 0));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>

      {!hasData ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">這個月還沒有支出紀錄。</p>
      ) : (
        <div className="mt-4 grid gap-5">
          {currencies.map((currency) => {
            const maxValue = Math.max(...points.map((point) => point.totals[currency]), 0);
            if (maxValue <= 0) return null;

            return (
              <div key={currency} className="grid gap-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold tracking-wide">{currency}</span>
                  <span>最高 {formatAmount(maxValue, currency)}</span>
                </div>
                <div className="flex h-24 items-end gap-1">
                  {points.map((point) => {
                    const value = point.totals[currency];
                    const height = Math.max(Math.round((value / maxValue) * 100), value > 0 ? 8 : 3);
                    return (
                      <div
                        key={`${currency}-${getLabel(point, labelKey)}`}
                        className="flex flex-1 items-end justify-center"
                        style={{ height: '100%' }}
                      >
                        <div
                          className={`w-full rounded-t ${value > 0 ? 'bg-family' : 'bg-slate-200'}`}
                          style={{ height: `${height}%` }}
                          title={formatAmount(value, currency)}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  {points.map((point, index) => (
                    <span
                      key={`label-${currency}-${getLabel(point, labelKey)}`}
                      className="flex-1 text-center text-[11px] text-slate-400"
                    >
                      {shouldShowLabel(point, index, points.length, labelKey) ? getLabel(point, labelKey) : ''}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// 由 LedgerPage 在 showForm/currencyFilter 等變動時重繪；props 來自 useMemo 後穩定，memo 可跳過重算。
export const ExpenseTrendChart = memo(ExpenseTrendChartBase);
