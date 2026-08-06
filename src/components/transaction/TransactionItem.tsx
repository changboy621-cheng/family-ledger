import { memo, useState } from 'react';
import type { Transaction } from '../../types';
import { formatAmount } from '../../lib/currency';
import { DEFAULT_AVATAR_COLOR, paymentMethodLabel } from '../../lib/constants';
import { splitHighlight } from '../../lib/search';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { Pencil, Trash2 } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
  onDelete?: (transactionId: string) => void;
  onEdit?: (transaction: Transaction) => void;
  /** 實際記帳人的名稱（與歸屬人不同時才會傳入），用於顯示「○○ 代記」 */
  recorderName?: string;
  /** 搜尋結果用：備註中此關鍵字以黃底 <mark> 高亮。 */
  highlightKeyword?: string;
}

function TransactionItemBase({ transaction, onDelete, onEdit, recorderName, highlightKeyword }: TransactionItemProps) {
  const isExpense = transaction.type === 'expense';
  // 備註預設單行截斷（不撐開版面），點一下切換顯示全文。
  const [noteExpanded, setNoteExpanded] = useState(false);
  const recordedByOther =
    transaction.recorded_by != null && transaction.recorded_by !== transaction.owner_id && Boolean(recorderName);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-2xl" aria-hidden="true">
              {transaction.category?.icon ?? '•'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{transaction.category?.name ?? '未分類'}</p>
              {transaction.note ? (
                <button
                  type="button"
                  className={`block w-full text-left text-sm text-slate-500 ${
                    noteExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'
                  }`}
                  onClick={() => setNoteExpanded((value) => !value)}
                  aria-expanded={noteExpanded}
                  title={noteExpanded ? '點一下收合備註' : '點一下展開完整備註'}
                >
                  {highlightKeyword
                    ? splitHighlight(transaction.note, highlightKeyword).map((segment, index) =>
                        segment.hit ? (
                          <mark key={index} className="rounded bg-yellow-200 px-0.5">
                            {segment.text}
                          </mark>
                        ) : (
                          <span key={index}>{segment.text}</span>
                        )
                      )
                    : transaction.note}
                </button>
              ) : (
                <p className="text-sm text-slate-500">無備註</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: transaction.owner?.avatar_color ?? DEFAULT_AVATAR_COLOR }}
            />
            <span>{transaction.owner?.display_name ?? '我'}</span>
            {transaction.payment_method ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {paymentMethodLabel(transaction.payment_method)}
              </span>
            ) : null}
            {recordedByOther ? (
              <span className="rounded-full bg-familySoft px-2 py-0.5 font-medium text-family">
                {recorderName} 代記
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

export const TransactionItem = memo(TransactionItemBase);
