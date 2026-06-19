import { formatAmount } from '../../lib/currency';
import type { Currency, DailyExpensePoint, MonthlyExpensePoint } from '../../types';

interface ExpenseTrendChartProps {
  title: string;
  description: string;
  points: DailyExpensePoint[] | MonthlyExpensePoint[];
  currencyFilter: Currency | 'all';
  labelKey: 'day' | 'label';
}

function visibleCurrencies(currencyFilter: Currency | 'all') {
  return currencyFilter === 'all' ? (['TWD', 'USD'] as Currency[]) : [currencyFilter];
}

function getLabel(point: DailyExpensePoint | MonthlyExpensePoint, labelKey: 'day' | 'label') {
  return labelKey === 'day' ? `${(point as DailyExpensePoint).day}` : (point as MonthlyExpensePoint).label;
}

export function ExpenseTrendChart({
  title,
  description,
  points,
  currencyFilter,
  labelKey
}: ExpenseTrendChartProps) {
  const currencies = visibleCurrencies(currencyFilter);
  const hasData = points.some((point) => currencies.some((currency) => point.totals[currency] > 0));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      {!hasData ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">目前還沒有足夠的支出資料可以畫出趨勢。</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {currencies.map((currency) => {
            const maxValue = Math.max(...points.map((point) => point.totals[currency]), 0);
            const activePoints = points.some((point) => point.totals[currency] > 0);
            if (!activePoints) return null;

            return (
              <div key={currency} className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                  <span className="text-xs text-slate-500">最高 {formatAmount(maxValue, currency)}</span>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex min-w-max items-end gap-2 rounded-lg bg-slate-50 px-3 py-4">
                    {points.map((point) => {
                      const value = point.totals[currency];
                      const height = maxValue > 0 ? Math.max((value / maxValue) * 96, value > 0 ? 8 : 2) : 2;

                      return (
                        <div key={`${currency}-${getLabel(point, labelKey)}`} className="grid w-8 gap-2 text-center">
                          <div className="flex h-28 items-end justify-center">
                            <div className="w-6 rounded-t bg-family/85" style={{ height }} title={formatAmount(value, currency)} />
                          </div>
                          <span className="text-[11px] text-slate-500">{getLabel(point, labelKey)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
