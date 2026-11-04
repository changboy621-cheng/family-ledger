import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatAmount } from '../../lib/currency';
import { formatRatio, ratioBarWidth, visibleCurrencies } from '../../lib/summaryView';
import type { Currency, OwnerExpenseSummary } from '../../types';
import type { CategoryDetailTarget } from './TransactionSearchModal';

interface SpenderAnalysisProps {
  items: OwnerExpenseSummary[];
  currencyFilter: Currency | 'all';
  /** 分析的月份（YYYY-MM）；下鑽時預設只看這個月。 */
  yearMonth?: string;
  /** 傳入時「成員 × 分類」列可點，開啟該成員在該分類的每一筆明細。 */
  onSelectCategory?: (target: CategoryDetailTarget) => void;
}

function SpenderAnalysisBase({ items, currencyFilter, yearMonth, onSelectCategory }: SpenderAnalysisProps) {
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
                            width: `${ratioBarWidth(item.ratios[currency])}%`,
                            backgroundColor: item.avatarColor
                          }}
                        />
                      </div>

                      <div className="mt-3 grid gap-2">
                        {item.categories
                          .filter((category) => category.totals[currency] > 0)
                          .map((category) => {
                            const key = `${currency}-${item.ownerId}-${category.categoryId}`;
                            const row = (
                              <div className="grid gap-1 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-slate-600">
                                    {category.categoryIcon} {category.categoryName}
                                  </span>
                                  <span className="font-medium text-slate-800">
                                    {formatAmount(category.totals[currency], currency)} · {formatRatio(category.ratios[currency])}
                                    {onSelectCategory ? (
                                      <ChevronRight className="ml-0.5 inline h-4 w-4 align-[-3px] text-slate-400" aria-hidden="true" />
                                    ) : null}
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${ratioBarWidth(category.ratios[currency])}%`,
                                      backgroundColor: item.avatarColor
                                    }}
                                  />
                                </div>
                              </div>
                            );

                            return onSelectCategory ? (
                              <button
                                key={key}
                                type="button"
                                className="-mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-1 text-left transition hover:bg-slate-100 active:opacity-70"
                                aria-label={`查看${item.ownerName}的${category.categoryName}明細`}
                                onClick={() =>
                                  onSelectCategory({
                                    categoryId: category.categoryId,
                                    categoryName: category.categoryName,
                                    categoryIcon: category.categoryIcon,
                                    ownerId: item.ownerId,
                                    ownerName: item.ownerName,
                                    yearMonth
                                  })
                                }
                              >
                                {row}
                              </button>
                            ) : (
                              <div key={key}>{row}</div>
                            );
                          })}
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

// 由 LedgerPage 在 showForm/currencyFilter 等變動時重繪；props 來自 useMemo 後穩定，memo 可跳過重算。
export const SpenderAnalysis = memo(SpenderAnalysisBase);
