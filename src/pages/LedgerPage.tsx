import { useCallback, useMemo, useState } from 'react';
import type { Currency, LedgerType, Transaction } from '../types';
import { currentYearMonth } from '../lib/utils';
import { CURRENCIES, formatAmount } from '../lib/currency';
import { useLedgerTransactions } from '../hooks/useTransactions';
import { usePendingDelete } from '../hooks/usePendingDelete';
import { useLedgerAnalysis } from '../hooks/useLedgerAnalysis';
import { MonthPicker } from '../components/common/MonthPicker';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { TransactionList } from '../components/transaction/TransactionList';
import { ExpenseCategorySummary } from '../components/transaction/ExpenseCategorySummary';
import { PaymentMethodSummary } from '../components/transaction/PaymentMethodSummary';
import { SpenderAnalysis } from '../components/transaction/SpenderAnalysis';
import { TopExpenseCategories } from '../components/transaction/TopExpenseCategories';
import { ExpenseTrendChart } from '../components/transaction/ExpenseTrendChart';
import { useUIStore } from '../store/uiStore';

interface LedgerPageProps {
  ledgerType: LedgerType;
}

export function LedgerPage({ ledgerType }: LedgerPageProps) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const {
    transactions: analysisTransactions,
    groupedTransactions,
    loading,
    error,
    loadTransactions,
    createTransaction,
    deleteTransaction,
    updateTransaction
  } = useLedgerTransactions(ledgerType, yearMonth, currencyFilter);
  const analysis = useLedgerAnalysis(analysisTransactions, yearMonth);
  const isFamily = ledgerType === 'family';
  const showToast = useUIStore((state) => state.showToast);
  // 只顯示有金額的幣別；都沒有時至少顯示 TWD，避免空卡
  const activeCurrencies = useMemo(() => {
    const active = CURRENCIES.filter(
      (currency) =>
        analysis.summary.expense[currency] !== 0 ||
        analysis.summary.income[currency] !== 0 ||
        analysis.summary.balance[currency] !== 0
    );
    return active.length > 0 ? active : [CURRENCIES[0]];
  }, [analysis.summary]);

  async function handleCreate(input: Parameters<typeof createTransaction>[0]) {
    await createTransaction(input);
    showToast('交易已新增');
  }

  const { pendingIds, requestDelete } = usePendingDelete(deleteTransaction);

  const handleSelectEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  }, []);

  async function handleEdit(input: Parameters<typeof createTransaction>[0]) {
    if (!editingTransaction) return;
    try {
      await updateTransaction({ id: editingTransaction.id, ...input });
      showToast('交易已更新');
      setEditingTransaction(null);
      setShowForm(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '更新失敗，請稍後再試。', 'error');
    }
  }

  return (
    <div className="grid gap-5">
      <header>
        <p className="text-sm font-semibold text-slate-500">{isFamily ? '共同可見' : '🔒 個人隱私'}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{isFamily ? '家庭帳本' : '個人帳本'}</h1>
      </header>

      <MonthPicker value={yearMonth} onChange={setYearMonth} />

      {error ? (
        <section className="rounded-xl border border-red-200 bg-white p-4 text-sm text-slate-600">
          本月財務資料載入失敗，請至下方交易清單按「重試」。
        </section>
      ) : (
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className={`grid gap-3 ${activeCurrencies.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {activeCurrencies.map((currency) => (
            <div key={currency} className={`rounded-lg p-3 ${isFamily ? 'bg-familySoft' : 'bg-personalSoft'}`}>
              <p className="text-xs font-semibold text-slate-500">{currency}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                結餘 {formatAmount(analysis.summary.balance[currency], currency)}
              </p>
              <div className="mt-1 flex gap-4 text-sm text-slate-500">
                <span>支出 {formatAmount(analysis.summary.expense[currency], currency)}</span>
                <span>收入 {formatAmount(analysis.summary.income[currency], currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

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

      {!error && (
        <>
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

      <PaymentMethodSummary
        items={analysis.expenseByPayment}
        currencyFilter={currencyFilter}
        title={isFamily ? '本月付款方式（現金／刷卡）' : '本月個人付款方式（現金／刷卡）'}
      />

      {isFamily ? <SpenderAnalysis items={analysis.expenseByOwner} currencyFilter={currencyFilter} /> : null}

      <ExpenseTrendChart
        title="本月每日支出"
        points={analysis.dailyExpenseTrend}
        currencyFilter={currencyFilter}
        labelKey="day"
      />

      <ExpenseTrendChart
        title="近 6 個月支出"
        points={analysis.monthlyExpenseTrend}
        currencyFilter={currencyFilter}
        labelKey="label"
      />
        </>
      )}

      <TransactionList
        groupedTransactions={groupedTransactions}
        loading={loading}
        error={error}
        onRetry={loadTransactions}
        onDelete={requestDelete}
        onEdit={handleSelectEdit}
        hiddenIds={pendingIds}
      />

      {showForm ? (
        <TransactionForm
          initialLedgerType={editingTransaction?.ledger_type ?? ledgerType}
          initialTransaction={editingTransaction}
          onSubmit={editingTransaction ? handleEdit : handleCreate}
          onClose={() => {
            setShowForm(false);
            setEditingTransaction(null);
          }}
        />
      ) : null}
    </div>
  );
}
