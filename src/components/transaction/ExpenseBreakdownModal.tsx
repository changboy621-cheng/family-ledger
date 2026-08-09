import { X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ExpenseCategoryPieChart } from './ExpenseCategoryPieChart';
import type { CategoryExpenseSummary } from '../../types';
import type { CategoryDetailTarget } from './TransactionSearchModal';

interface ExpenseBreakdownModalProps {
  title: string;
  items: CategoryExpenseSummary[];
  onClose: () => void;
  /** 點類別下鑽看細項（由父層開啟分類明細）。 */
  onSelectCategory: (target: CategoryDetailTarget) => void;
}

// 首頁「本月支出」卡片點開後的圓餅圖分析視窗：圖＋可點的分類清單。
export function ExpenseBreakdownModal({ title, items, onClose, onSelectCategory }: ExpenseBreakdownModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid gap-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600"
            onClick={onClose}
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <p className="text-sm text-slate-500">點任一分類可查看該類別的所有交易細項。</p>

        <ExpenseCategoryPieChart
          items={items}
          currencyFilter="all"
          title="支出分類占比"
          onSelectCategory={onSelectCategory}
        />
      </div>
    </Modal>
  );
}
