import { memo } from 'react';
import { formatAmount } from '../../lib/currency';
import { formatRatio, ratioBarWidth, visibleCurrencies } from '../../lib/summaryView';
import type { Currency, PaymentExpenseSummary } from '../../types';

interface PaymentMethodSummaryProps {
  items: PaymentExpenseSummary[];
  currencyFilter: Currency | 'all';
  title?: string;
}

const METHOD_LABELS: Record<PaymentExpenseSummary['method'], { name: string; icon: string }> = {
  cash: { name: '現金', icon: '💵' },
  card: { name: '刷卡', icon: '💳' },
  unspecified: { name: '未指定', icon: '🧾' }
};

function PaymentMethodSummaryBase({
  items,
  currencyFilter,
  title = '本月付款方式'
}: PaymentMethodSummaryProps) {
  const currencies = visibleCurrencies(currencyFilter);
  const hasData = items.some((item) => currencies.some((currency) => item.totals[currency] > 0));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>

      {!hasData ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">本月尚無付款方式資料。</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {currencies.map((currency) => {
            const rows = items.filter((item) => item.totals[currency] > 0);
            if (rows.length === 0) return null;

            return (
              <div key={currency} className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currency}</p>
                <div className="grid gap-2">
                  {rows.map((item) => (
                    <div key={`${currency}-${item.method}`} className="rounded-lg bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl" aria-hidden="true">
                            {METHOD_LABELS[item.method].icon}
                          </span>
                          <span className="font-medium text-slate-900">{METHOD_LABELS[item.method].name}</span>
                        </div>
                        <div className="text-right">
                          <strong className="block text-slate-900">{formatAmount(item.totals[currency], currency)}</strong>
                          <span className="text-xs font-medium text-slate-500">{formatRatio(item.ratios[currency])}</span>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-family transition-all"
                          style={{ width: `${ratioBarWidth(item.ratios[currency])}%` }}
                        />
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
export const PaymentMethodSummary = memo(PaymentMethodSummaryBase);
