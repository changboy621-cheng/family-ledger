import { LineChart, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAmount } from '../../lib/currency';
import { useAccounts } from '../../hooks/useAccounts';

/** 首頁兩個入口：資產（顯示淨資產）與年度報表。手機底部導覽只有 5 格，靠這裡進去。 */
export function DashboardShortcuts() {
  const { accounts, netWorth, status } = useAccounts();
  const hasAccounts = status === 'ready' && accounts.length > 0;

  return (
    <section className="grid grid-cols-2 gap-3">
      <Link to="/assets" className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-card p-4 shadow-sm hover:bg-slate-50">
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-600">資產</span>
        </span>
        <span className="block truncate text-lg font-bold text-slate-900">
          {hasAccounts ? formatAmount(netWorth.TWD, 'TWD') : '建立帳戶 →'}
        </span>
      </Link>
      <Link to="/reports" className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-card p-4 shadow-sm hover:bg-slate-50">
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
            <LineChart className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-slate-600">報表</span>
        </span>
        <span className="block truncate text-lg font-bold text-slate-900">
          看年度報表 →
        </span>
      </Link>
    </section>
  );
}
