import { formatAmount } from '../../lib/currency';
import type { CategoryExpenseSummary, Currency } from '../../types';

interface TopExpenseCategoriesProps {
  items: CategoryExpenseSummary[];
  currencyFilter: Currency | 'all';
  title: string;
}

function visibleCurrencies(currencyFilter: Currency | 'all') {
  return currencyFilter === 'all' ? (['TWD', 'USD'] as Currency[]) : [currencyFilter];
}

function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function TopExpenseCategories({ items, currencyFilter, title }: TopExpenseCategoriesProps) {
  const currencies = visibleCurrencies(currencyFilter);
  const hasData = items.some((item) => currencies.some((currency) => item.totals[currency] > 0));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">先看這個月最大宗的 3 類支出。</p>

      {!hasData ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">本月尚無前 3 大支出資料。</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {currencies.map((currency) => {
            const ranked = items.filter((item) => item.totals[currency] > 0).slice(0, 3);
            if (ranked.length === 0) return null;

            return (
              <div key={currency} className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                <div className="grid gap-2">
                  {ranked.map((item, index) => (
                    <div key={`${currency}-${item.categoryId}`} className="rounded-lg bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-bold text-slate-500">
                            {index + 1}
                          </span>
                          <span className="text-lg" aria-hidden="true">
                            {item.categoryIcon}
                          </span>
                          <span className="font-medium text-slate-900">{item.categoryName}</span>
                        </div>
                        <div className="text-right">
                          <strong className="block text-slate-900">{formatAmount(item.totals[currency], currency)}</strong>
                          <span className="text-xs font-medium text-slate-500">{formatRatio(item.ratios[currency])}</span>
                        </div>
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
