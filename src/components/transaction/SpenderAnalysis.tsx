import { formatAmount } from '../../lib/currency';
import type { Currency, OwnerExpenseSummary } from '../../types';

interface SpenderAnalysisProps {
  items: OwnerExpenseSummary[];
  currencyFilter: Currency | 'all';
}

function visibleCurrencies(currencyFilter: Currency | 'all') {
  return currencyFilter === 'all' ? (['TWD', 'USD'] as Currency[]) : [currencyFilter];
}

function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function SpenderAnalysis({ items, currencyFilter }: SpenderAnalysisProps) {
  const currencies = visibleCurrencies(currencyFilter);
  const hasData = items.some((item) => currencies.some((currency) => item.totals[currency] > 0));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">支出人分析</h2>

      {!hasData ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">本月尚無支出人分析資料。</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {currencies.map((currency) => {
            const owners = items.filter((item) => item.totals[currency] > 0);
            if (owners.length === 0) return null;

            return (
              <div key={currency} className="grid gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                <div className="grid gap-3">
                  {owners.map((item) => (
                    <div key={`${currency}-${item.ownerId}`} className="rounded-lg bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.avatarColor }}
                            aria-hidden="true"
                          />
                          <strong className="text-slate-900">{item.ownerName}</strong>
                        </div>
                        <div className="text-right">
                          <strong className="block text-slate-900">{formatAmount(item.totals[currency], currency)}</strong>
                          <span className="text-xs font-medium text-slate-500">{formatRatio(item.ratios[currency])}</span>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(item.ratios[currency] * 100, item.ratios[currency] > 0 ? 6 : 0)}%`,
                            backgroundColor: item.avatarColor
                          }}
                        />
                      </div>

                      <div className="mt-3 grid gap-2">
                        {item.categories
                          .filter((category) => category.totals[currency] > 0)
                          .map((category) => (
                            <div
                              key={`${currency}-${item.ownerId}-${category.categoryId}`}
                              className="grid gap-1 text-sm"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-600">
                                  {category.categoryIcon} {category.categoryName}
                                </span>
                                <span className="font-medium text-slate-800">
                                  {formatAmount(category.totals[currency], currency)} · {formatRatio(category.ratios[currency])}
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(category.ratios[currency] * 100, category.ratios[currency] > 0 ? 6 : 0)}%`,
                                    backgroundColor: item.avatarColor
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
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
