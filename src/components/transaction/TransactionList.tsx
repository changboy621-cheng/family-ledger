import { memo, useMemo } from 'react';
import type { Transaction } from '../../types';
import { TransactionItem } from './TransactionItem';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';

interface TransactionListProps {
  groupedTransactions: Record<string, Transaction[]>;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  onDelete?: (transactionId: string) => void;
  onEdit?: (transaction: Transaction) => void;
  hiddenIds?: string[];
}

function TransactionListBase({
  groupedTransactions,
  loading,
  error = false,
  onRetry,
  onDelete,
  onEdit,
  hiddenIds = []
}: TransactionListProps) {
  const { members } = useFamilyMembers();
  const memberNames = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member.display_name])),
    [members]
  );

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">載入交易中...</div>;
  }

  // 讀取失敗：明確顯示錯誤與重試，而非偽裝成「沒有交易」（對記帳 App 最具誤導性的失敗模式）。
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-600">載入失敗，請檢查網路後再試。</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            重試
          </button>
        ) : null}
      </div>
    );
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
                recorderName={transaction.recorded_by ? memberNames[transaction.recorded_by] : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export const TransactionList = memo(TransactionListBase);
