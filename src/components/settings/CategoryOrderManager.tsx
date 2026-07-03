import { useEffect, useRef, useState } from 'react';
import type { Category } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { SortableList } from '../common/SortableList';

// 設定頁的「類別排序」：支出／收入各一個可拖曳清單，放開即儲存到 families.category_order。
// 兩個清單合併成單一順序陣列（支出在前、收入在後）持久化；讀取端會依此排序。
export function CategoryOrderManager() {
  const { categories: expense } = useCategories('expense');
  const { categories: income } = useCategories('income');
  const { updateCategoryOrder } = useAuth();

  const [expenseList, setExpenseList] = useState<Category[]>(expense);
  const [incomeList, setIncomeList] = useState<Category[]>(income);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 外部來源變動（新增／刪除／改名，或初次載入）時同步本地清單。
  // 以 id 序列比對，避免拖曳當下的樂觀更新又被同序列的新陣列覆蓋而造成跳動。
  const expenseKey = expense.map((c) => c.id).join(',');
  const incomeKey = income.map((c) => c.id).join(',');
  useEffect(() => setExpenseList(expense), [expenseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setIncomeList(income), [incomeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  async function persist(nextExpense: Category[], nextIncome: Category[]) {
    setStatus('saving');
    try {
      await updateCategoryOrder([...nextExpense, ...nextIncome].map((c) => c.id));
      setStatus('saved');
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('error');
    }
  }

  if (expense.length === 0 && income.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">尚無類別可排序。</p>;
  }

  return (
    <div className="mt-4 grid gap-5">
      <p className="text-sm text-slate-500">拖曳左側把手 <span aria-hidden="true">⠿</span> 調整順序，放開即自動儲存。順序會套用到記帳時的類別選單。</p>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">支出類別</h3>
          <StatusHint status={status} />
        </div>
        <SortableList
          items={expenseList}
          getId={(c) => c.id}
          onReorder={setExpenseList}
          onCommit={(next) => void persist(next, incomeList)}
          renderItem={(c) => (
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <span className="text-xl" aria-hidden="true">{c.icon}</span>
              {c.name}
            </span>
          )}
        />
      </div>

      {incomeList.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold text-slate-700">收入類別</h3>
          <SortableList
            items={incomeList}
            getId={(c) => c.id}
            onReorder={setIncomeList}
            onCommit={(next) => void persist(expenseList, next)}
            renderItem={(c) => (
              <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span className="text-xl" aria-hidden="true">{c.icon}</span>
                {c.name}
              </span>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatusHint({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'saving') return <span className="text-xs text-slate-400">儲存中…</span>;
  if (status === 'saved') return <span className="text-xs text-family">已儲存</span>;
  if (status === 'error') return <span className="text-xs text-red-600">儲存失敗，請稍後再試</span>;
  return null;
}
