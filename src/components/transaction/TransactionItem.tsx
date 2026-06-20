import type { Transaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { Pencil, Trash2 } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
  onDelete?: (transactionId: string) => void;
  onEdit?: (transaction: Transaction) => void;
}

export function TransactionItem({ transaction, onDelete, onEdit }: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';
  const recordedByOther =
    transaction.recorded_by != null &&
    transaction.recorded_by !== transaction.owner_id &&
    transaction.recorder?.display_name;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
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
            {transaction.payment_method ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {transaction.payment_method === 'cash' ? '現金' : '刷卡'}
              </span>
            ) : null}
            {recordedByOther ? (
              <span className="rounded-full bg-familySoft px-2 py-0.5 font-medium text-family">
                {transaction.recorder?.display_name} 代記
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid justify-items-end gap-3">
          <div className="flex items-center gap-2">
            <CurrencyBadge currency={transaction.currency} />
            <strong className={isExpense ? 'text-red-500' : 'text-green-600'}>
              {isExpense ? '-' : '+'}
              {formatAmount(Number(transaction.amount), transaction.currency)}
            </strong>
          </div>
          {onEdit || onDelete ? (
            <div className="flex items-center gap-2">
              {onEdit ? (
                <button
                  className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-family"
                  type="button"
                  onClick={() => onEdit(transaction)}
                  aria-label="編輯交易"
                  title="編輯交易"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  className="grid h-10 w-10 place-items-center rounded-lg border border-red-200 text-red-500 transition hover:bg-red-50"
                  type="button"
                  onClick={() => onDelete(transaction.id)}
                  aria-label="刪除交易"
                  title="刪除交易"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
