import type { Transaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { Pencil, Trash2 } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
  onDelete?: (transactionId: string) => Promise<void>;
  onEdit?: (transaction: Transaction) => void;
  deleting?: boolean;
}

export function TransactionItem({ transaction, onDelete, onEdit, deleting = false }: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';

  async function handleDelete() {
    if (!onDelete) return;
    const confirmed = window.confirm('確定要刪除這筆交易嗎？刪除後無法復原。');
    if (!confirmed) return;
    await onDelete(transaction.id);
  }

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
          <div className="flex items-center gap-2">
            <CurrencyBadge currency={transaction.currency} />
            {onEdit ? (
              <button
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-family"
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
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                aria-label="刪除交易"
                title="刪除交易"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <strong className={isExpense ? 'text-red-500' : 'text-green-600'}>
            {isExpense ? '-' : '+'}
            {formatAmount(Number(transaction.amount), transaction.currency)}
          </strong>
          {deleting ? <span className="text-xs text-slate-400">刪除中...</span> : null}
        </div>
      </div>
    </li>
  );
}
