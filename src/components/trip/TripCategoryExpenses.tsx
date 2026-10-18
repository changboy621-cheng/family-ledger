import { paymentMethodLabel } from '../../lib/constants';
import { formatTripAmount, formatTwd, ownTwd, type TripExpense } from '../../lib/trips';

interface TripCategoryExpensesProps {
  /** 這個分類的花費（新到舊）。 */
  expenses: TripExpense[];
  memberName: (id: string | null | undefined) => string;
  /** 點某筆開啟編輯；未提供則只顯示。 */
  onSelect?: (expense: TripExpense) => void;
}

// 分類展開後的明細：每筆是誰付的、刷卡還是現金、實際負擔多少（有代墊時另註整筆金額）。
export function TripCategoryExpenses({ expenses, memberName, onSelect }: TripCategoryExpensesProps) {
  return (
    <ul className="mt-2 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3">
      {expenses.map((expense) => {
        const shared = (expense.friend_shares ?? []).length > 0;
        const content = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-slate-800">{expense.note || '（無備註）'}</span>
              <span className="text-xs text-slate-500">
                {[
                  expense.expense_date.slice(5).replace('-', '/'),
                  memberName(expense.paid_by) || '未記付款人',
                  paymentMethodLabel(expense.payment_method) || '未指定'
                ].join('・')}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <strong className="block text-sm text-slate-900">{formatTwd(ownTwd(expense))}</strong>
              <span className="text-xs text-slate-400">
                {shared
                  ? `整筆 ${formatTripAmount(expense.amount, expense.currency)}，含代墊`
                  : expense.currency !== 'TWD'
                    ? formatTripAmount(expense.amount, expense.currency)
                    : ''}
              </span>
            </span>
          </>
        );
        return (
          <li key={expense.id}>
            {onSelect ? (
              <button type="button" className="flex w-full items-center gap-3 py-2 text-left" onClick={() => onSelect(expense)}>
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-3 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
