import type { Transaction } from '../../types';
import { TransactionItem } from './TransactionItem';

interface TransactionListProps {
  groupedTransactions: Record<string, Transaction[]>;
  loading: boolean;
  onDelete?: (transactionId: string) => void;
  onEdit?: (transaction: Transaction) => void;
  hiddenIds?: string[];
}

export function TransactionList({
  groupedTransactions,
  loading,
  onDelete,
  onEdit,
  hiddenIds = []
}: TransactionListProps) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">載入交易中...</div>;
  }

  // 過濾掉等待刪除（已樂觀隱藏）的項目，並丟掉因此清空的日期分組
  const visibleGroups = Object.entries(groupedTransactions)
    .map(([date, items]) => [date, items.filter((item) => !hiddenIds.includes(item.id))] as const)
    .filter(([, items]) => items.length > 0);

  if (Object.keys(groupedTransactions).length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">這個月份還沒有交易。</div>;
  }

  return (
    <div className="grid gap-5">
      {visibleGroups.map(([date, items]) => (
        <section key={date} className="grid gap-3">
          <h3 className="text-sm font-semibold text-slate-500">{date}</h3>
          <ul className="grid gap-3">
            {items.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
