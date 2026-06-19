import type { Transaction } from '../../types';
import { TransactionItem } from './TransactionItem';

interface TransactionListProps {
  groupedTransactions: Record<string, Transaction[]>;
  loading: boolean;
}

export function TransactionList({ groupedTransactions, loading }: TransactionListProps) {
  const dates = Object.keys(groupedTransactions);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">載入交易中...</div>;
  }

  if (dates.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">這個月份還沒有交易。</div>;
  }

  return (
    <div className="grid gap-5">
      {dates.map((date) => (
        <section key={date} className="grid gap-3">
          <h3 className="text-sm font-semibold text-slate-500">{date}</h3>
          <ul className="grid gap-3">
            {groupedTransactions[date].map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
