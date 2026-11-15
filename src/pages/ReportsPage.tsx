import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction } from '../types';
import { formatAmount } from '../lib/currency';
import { buildYearReport, compareMonth } from '../lib/reports';
import { currentYearMonth } from '../lib/utils';
import { useReportData } from '../hooks/useReportData';

type Scope = 'all' | 'family' | 'personal';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'family', label: '家庭' },
  { value: 'personal', label: '個人' }
];

const twd = (value: number) => formatAmount(value, 'TWD');
const pct = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`);
const chip = (on: boolean) => `rounded-full px-4 py-2 text-sm font-semibold ${on ? 'bg-slate-900 text-white' : 'bg-card text-slate-600'}`;

export function ReportsPage() {
  const thisMonth = currentYearMonth();
  const [year, setYear] = useState(Number(thisMonth.slice(0, 4)));
  const [scope, setScope] = useState<Scope>('all');
  const [month, setMonth] = useState(thisMonth);
  const { family, personal, loading, error, reload } = useReportData(year);

  const rows: Transaction[] = useMemo(
    () => (scope === 'family' ? family : scope === 'personal' ? personal : [...family, ...personal]),
    [family, personal, scope]
  );
  const report = useMemo(() => buildYearReport(rows, year), [rows, year]);
  const comparison = useMemo(() => compareMonth(rows, month), [rows, month]);
  const hasUSD = rows.some((transaction) => transaction.currency === 'USD' && transaction.transaction_date.startsWith(`${year}-`));
  const maxMonth = Math.max(1, ...report.months.flatMap((item) => [item.income, item.expense]));
  const maxCategory = report.categories[0]?.total ?? 1;
  const isThisYear = year === Number(thisMonth.slice(0, 4));

  function changeYear(next: number) {
    setYear(next);
    // 月對月預設看該年度最後一個有意義的月份：今年看本月，往年看 12 月。
    setMonth(next === Number(thisMonth.slice(0, 4)) ? thisMonth : `${next}-12`);
  }

  return (
    <div className="grid gap-5 [&>*]:min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">報表</h1>
        <div className="flex items-center rounded-full border border-slate-200 bg-card shadow-sm">
          <button type="button" className="grid h-10 w-10 place-items-center text-slate-600" aria-label="上一年" onClick={() => changeYear(year - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="px-1 font-bold text-slate-900">{year}</span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center text-slate-600 disabled:opacity-30"
            aria-label="下一年"
            disabled={isThisYear}
            onClick={() => changeYear(year + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex gap-2">
        {SCOPES.map((option) => (
          <button key={option.value} type="button" className={chip(scope === option.value)} onClick={() => setScope(option.value)}>
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <section className="rounded-xl border border-red-200 bg-card p-4 text-sm text-slate-600 shadow-sm">
          報表資料載入失敗。
          <button type="button" className="ml-2 font-semibold text-action" onClick={() => void reload()}>
            重試
          </button>
        </section>
      ) : loading ? (
        <section className="rounded-xl border border-slate-200 bg-card p-6 text-center text-slate-500 shadow-sm">整理 {year} 年的帳中...</section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            {[
              { label: '全年支出', value: twd(report.expense) },
              { label: '全年收入', value: twd(report.income) },
              { label: '結餘', value: twd(report.balance), tone: report.balance < 0 ? 'text-red-600' : 'text-slate-900' },
              { label: '儲蓄率', value: report.savingsRate === null ? '還沒有收入' : `${Math.round(report.savingsRate * 100)}%` }
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-600">{stat.label}</p>
                <p className={`mt-2 truncate text-2xl font-bold tracking-tight ${stat.tone ?? 'text-slate-900'}`}>{stat.value}</p>
              </div>
            ))}
          </section>
          {hasUSD ? <p className="-mt-2 px-1 text-xs text-slate-500">報表以新台幣計算，美金交易未計入。</p> : null}

          <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold text-slate-900">每月收支</h2>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-800" />支出</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-family" />收入</span>
              </span>
            </div>
            <div className="mt-5 grid h-40 grid-cols-12 items-end gap-1.5">
              {report.months.map((item) => {
                const selected = item.month === month;
                return (
                  <button
                    key={item.month}
                    type="button"
                    title={`${Number(item.month.slice(5))} 月：支出 ${twd(item.expense)}，收入 ${twd(item.income)}`}
                    aria-label={`看 ${Number(item.month.slice(5))} 月的比較`}
                    aria-pressed={selected}
                    className={`flex h-full items-end justify-center gap-0.5 rounded-md px-0.5 ${selected ? 'bg-actionSoft' : ''}`}
                    onClick={() => setMonth(item.month)}
                  >
                    <span className="w-1/2 rounded-t bg-slate-800" style={{ height: `${(item.expense / maxMonth) * 100}%` }} />
                    <span className="w-1/2 rounded-t bg-family" style={{ height: `${(item.income / maxMonth) * 100}%` }} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-12 gap-1.5 text-center text-[11px] text-slate-500">
              {report.months.map((item) => (
                <span key={item.month} className={item.month === month ? 'font-bold text-action' : ''}>
                  {Number(item.month.slice(5))}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">點某個月，下方會比較那個月的分類花費。</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">{Number(month.slice(5))} 月和上個月比</h2>
            <p className="mt-1 text-sm text-slate-600">
              本月 {twd(comparison.totals.current)}，上月 {twd(comparison.totals.lastMonth)}，去年同月 {twd(comparison.totals.lastYear)}
            </p>
            {comparison.rows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">這兩個月都沒有支出。</p>
            ) : (
              <div className="mt-4">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="w-[34%] py-2 font-semibold">類別</th>
                      <th className="py-2 text-right font-semibold">本月</th>
                      <th className="py-2 text-right font-semibold">比上月</th>
                      <th className="py-2 text-right font-semibold">比去年</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparison.rows.map((row) => (
                      <tr key={row.categoryId}>
                        <td className="truncate py-2.5">
                          <span className="mr-1" aria-hidden="true">{row.icon}</span>
                          <span className="font-semibold text-slate-900">{row.name}</span>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">{twd(row.current)}</td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 ${
                              row.notable === 'up' ? 'font-bold text-red-600' : row.notable === 'down' ? 'font-bold text-green-700' : 'text-slate-500'
                            }`}
                          >
                            {row.notable === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" aria-label="明顯增加" /> : null}
                            {row.notable === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" aria-label="明顯減少" /> : null}
                            {pct(row.vsLastMonth)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-500">{pct(row.vsLastYear)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-500">紅色箭頭：比上月多花 30% 以上且超過 NT$500；綠色：明顯減少。</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">{year} 年花在哪</h2>
            {report.categories.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">這一年還沒有支出。</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {report.categories.slice(0, 8).map((item) => (
                  <li key={item.categoryId} className="grid gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-900">
                        <span className="mr-1.5" aria-hidden="true">{item.icon}</span>
                        {item.name}
                      </span>
                      <span className="text-slate-700">
                        {twd(item.total)}
                        <span className="ml-2 text-xs text-slate-500">{Math.round((item.total / Math.max(report.expense, 1)) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-800" style={{ width: `${(item.total / maxCategory) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {report.topExpenses.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">最大的 5 筆支出</h2>
              <ol className="mt-3 divide-y divide-slate-100">
                {report.topExpenses.map((transaction) => (
                  <li key={transaction.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span aria-hidden="true">{transaction.category?.icon ?? '•'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{transaction.note || transaction.category?.name}</span>
                      <span className="block text-xs text-slate-500">
                        {transaction.transaction_date} · {transaction.ledger_type === 'family' ? '家庭' : '個人'}
                      </span>
                    </span>
                    <span className="font-bold text-slate-900">{twd(Number(transaction.amount))}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
