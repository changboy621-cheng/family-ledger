import type { Transaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { CurrencyBadge } from '../common/CurrencyBadge';

interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              {transaction.category?.icon ?? '•'}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{transaction.category?.name ?? '未分類'}</p>
              <p className="truncate text-sm text-slate-500">{transaction.note || '無備註'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: transaction.owner?.avatar_color ?? '#64748B' }}
            />
            <span>{transaction.owner?.display_name ?? '我'}</span>
          </div>
        </div>
        <div className="grid justify-items-end gap-2">
          <CurrencyBadge currency={transaction.currency} />
          <strong className={isExpense ? 'text-red-500' : 'text-green-600'}>
            {isExpense ? '-' : '+'}
            {formatAmount(Number(transaction.amount), transaction.currency)}
          </strong>
        </div>
      </div>
    </li>
  );
}
