import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Budget, Category, LedgerType, Transaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { formatRatio } from '../../lib/summaryView';
import { budgetsForLedger, computeBudgetProgress, type BudgetProgress, type BudgetStatus } from '../../lib/budget';

interface BudgetProgressCardProps {
  budgets: Budget[];
  profileId: string;
  familyTransactions: Transaction[];
  personalTransactions: Transaction[];
  categories: Category[];
  /** 本月已經過的比例（0–1），用來對照花費速度。 */
  monthElapsed: number;
}

const STATUS_BAR: Record<BudgetStatus, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  over: 'bg-red-500'
};

// 首頁「本月預算」：家庭／個人各自的總預算與類別預算使用進度，80% 變黃、超過變紅。
function BudgetProgressCardBase({
  budgets,
  profileId,
  familyTransactions,
  personalTransactions,
  categories,
  monthElapsed
}: BudgetProgressCardProps) {
  const groups: Array<{ ledgerType: LedgerType; title: string; progress: BudgetProgress[] }> = [
    {
      ledgerType: 'family',
      title: '家庭預算',
      progress: computeBudgetProgress(budgetsForLedger(budgets, 'family', profileId), familyTransactions)
    },
    {
      ledgerType: 'personal',
      title: '我的個人預算',
      progress: computeBudgetProgress(budgetsForLedger(budgets, 'personal', profileId), personalTransactions)
    }
  ];
  const hasBudget = groups.some((group) => group.progress.length > 0);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="本月預算">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">本月預算</h2>
          <p className="mt-0.5 text-xs text-slate-400">本月已過 {formatRatio(monthElapsed)}</p>
        </div>
        <Link to="/settings#budget" className="text-sm font-semibold text-family">
          {hasBudget ? '調整' : '設定'}
        </Link>
      </div>

      {!hasBudget ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          還沒有設定預算。到「設定 → 每月預算」訂一個總額，每個月會自動沿用。
        </p>
      ) : (
        <div className="mt-4 grid gap-5">
          {groups.map((group) =>
            group.progress.length === 0 ? null : (
              <div key={group.ledgerType} className="grid gap-3">
                <h3 className="text-sm font-semibold text-slate-700">{group.title}</h3>
                {group.progress.map((item) => (
                  <BudgetRow
                    key={item.budget.id}
                    item={item}
                    category={item.budget.category_id ? categoryById.get(item.budget.category_id) : undefined}
                    monthElapsed={monthElapsed}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

function BudgetRow({
  item,
  category,
  monthElapsed
}: {
  item: BudgetProgress;
  category: Category | undefined;
  monthElapsed: number;
}) {
  const { budget, spent, ratio, status } = item;
  const remaining = budget.amount - spent;
  const label = budget.category_id === null ? '總預算' : category ? `${category.icon} ${category.name}` : '（已刪除的類別）';

  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-slate-900">
          {label}
          {budget.currency === 'USD' ? <span className="ml-1 text-xs text-slate-400">USD</span> : null}
        </span>
        <span className={`shrink-0 text-xs font-semibold ${status === 'over' ? 'text-red-600' : 'text-slate-500'}`}>
          {remaining >= 0
            ? `剩 ${formatAmount(remaining, budget.currency)}`
            : `超支 ${formatAmount(-remaining, budget.currency)}`}
        </span>
      </div>
      <div
        className="relative h-2 rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${label}已用 ${formatRatio(ratio)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
      >
        <div className={`h-2 rounded-full ${STATUS_BAR[status]}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
        {/* 時間進度參考線：花費條超過這條代表花得比時間快 */}
        <div
          className="absolute -top-1 h-4 w-px bg-slate-400"
          style={{ left: `${Math.min(monthElapsed, 1) * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="text-xs text-slate-400">
        {formatAmount(spent, budget.currency)} / {formatAmount(budget.amount, budget.currency)}（{formatRatio(ratio)}）
      </p>
    </div>
  );
}

export const BudgetProgressCard = memo(BudgetProgressCardBase);
