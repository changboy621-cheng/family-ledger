import { useState } from 'react';
import type { Currency, LedgerType } from '../types';
import { currentYearMonth } from '../lib/utils';
import { formatAmount } from '../lib/currency';
import { useAnalysisTransactions, useTransactions } from '../hooks/useTransactions';
import { useLedgerAnalysis } from '../hooks/useLedgerAnalysis';
import { MonthPicker } from '../components/common/MonthPicker';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { TransactionList } from '../components/transaction/TransactionList';
import { ExpenseCategorySummary } from '../components/transaction/ExpenseCategorySummary';
import { SpenderAnalysis } from '../components/transaction/SpenderAnalysis';
import { TopExpenseCategories } from '../components/transaction/TopExpenseCategories';
import { ExpenseTrendChart } from '../components/transaction/ExpenseTrendChart';

interface LedgerPageProps {
  ledgerType: LedgerType;
}

export function LedgerPage({ ledgerType }: LedgerPageProps) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const { groupedTransactions, loading, createTransaction, deleteTransaction } = useTransactions(
    ledgerType,
    yearMonth,
    currencyFilter
  );
  const { transactions: analysisTransactions, loadTransactions: reloadAnalysisTransactions } =
    useAnalysisTransactions(ledgerType, yearMonth);
  const analysis = useLedgerAnalysis(analysisTransactions, yearMonth);
  const isFamily = ledgerType === 'family';

  async function handleCreate(input: Parameters<typeof createTransaction>[0]) {
    await createTransaction(input);
    await reloadAnalysisTransactions();
  }

  async function handleDelete(transactionId: string) {
    setDeletingIds((current) => [...current, transactionId]);
    try {
      await deleteTransaction(transactionId);
      await reloadAnalysisTransactions();
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== transactionId));
    }
  }

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold text-slate-500">{isFamily ? '共同可見' : '🔒 個人隱私'}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{isFamily ? '家庭帳本' : '個人帳本'}</h1>
      </header>

      <MonthPicker value={yearMonth} onChange={setYearMonth} />

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
        {(['TWD', 'USD'] as Currency[]).map((currency) => (
          <div key={currency} className="grid gap-1">
            <p className="text-xs font-semibold text-slate-500">{currency}</p>
            <p className="text-sm text-slate-500">支出 {formatAmount(analysis.summary.expense[currency], currency)}</p>
            <p className="text-sm text-slate-500">收入 {formatAmount(analysis.summary.income[currency], currency)}</p>
            <p className="text-lg font-bold text-slate-900">結餘 {formatAmount(analysis.summary.balance[currency], currency)}</p>
          </div>
        ))}
      </section>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['all', 'TWD', 'USD'] as const).map((option) => (
            <button
              key={option}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                currencyFilter === option ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
              }`}
              type="button"
              onClick={() => setCurrencyFilter(option)}
            >
              {option === 'all' ? '全部' : option}
            </button>
          ))}
        </div>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${isFamily ? 'bg-family' : 'bg-personal'}`}
          type="button"
          onClick={() => setShowForm(true)}
        >
          新增
        </button>
      </div>

      <TopExpenseCategories
        items={analysis.topCategories}
        currencyFilter={currencyFilter}
        title={isFamily ? '本月前 3 大支出類別' : '本月個人前 3 大支出類別'}
      />

      <ExpenseCategorySummary
        items={analysis.expenseByCategory}
        currencyFilter={currencyFilter}
        title={isFamily ? '本月支出分類' : '本月個人支出分類'}
      />

      {isFamily ? <SpenderAnalysis items={analysis.expenseByOwner} currencyFilter={currencyFilter} /> : null}

      <ExpenseTrendChart
        title="本月每日支出"
        description="看這個月每天的支出高低變化。"
        points={analysis.dailyExpenseTrend}
        currencyFilter={currencyFilter}
        labelKey="day"
      />

      <ExpenseTrendChart
        title="近 6 個月支出"
        description="看近半年每個月的支出趨勢。"
        points={analysis.monthlyExpenseTrend}
        currencyFilter={currencyFilter}
        labelKey="label"
      />

      <TransactionList
        groupedTransactions={groupedTransactions}
        loading={loading}
        onDelete={handleDelete}
        deletingIds={deletingIds}
      />

      {showForm ? (
        <TransactionForm
          initialLedgerType={ledgerType}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      ) : null}
    </div>
  );
}
