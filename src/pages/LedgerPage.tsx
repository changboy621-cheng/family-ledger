import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Currency, LedgerType, Transaction } from '../types';
import { currentYearMonth } from '../lib/utils';
import { CURRENCIES, formatAmount } from '../lib/currency';
import { useLedgerTransactions } from '../hooks/useTransactions';
import { usePendingDelete } from '../hooks/usePendingDelete';
import { useLedgerAnalysis } from '../hooks/useLedgerAnalysis';
import { FAB } from '../components/common/FAB';
import { MonthPicker } from '../components/common/MonthPicker';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { TransactionList } from '../components/transaction/TransactionList';
import { LedgerAnalysis } from '../components/transaction/LedgerAnalysis';
import { TransactionSearchModal, type CategoryDetailTarget } from '../components/transaction/TransactionSearchModal';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { useUIStore } from '../store/uiStore';

interface LedgerPageProps {
  ledgerType: LedgerType;
}

export function LedgerPage({ ledgerType }: LedgerPageProps) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<CategoryDetailTarget | null>(null);
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

      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <MonthPicker value={yearMonth} onChange={setYearMonth} />
        </div>
        <button
          type="button"
          className="grid w-14 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:text-family"
          onClick={() => setSearchOpen(true)}
          aria-label="搜尋交易"
          title="搜尋備註（跨全部月份）"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

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

      {/* 最近支出明細移到圖表上方，預設收合、有需要再打開。 */}
      <CollapsibleSection title="最近支出明細" subtitle="本月每一筆交易">
        <TransactionList
          groupedTransactions={groupedTransactions}
          loading={loading}
          error={error}
          onRetry={loadTransactions}
          onDelete={requestDelete}
          onEdit={handleSelectEdit}
          hiddenIds={pendingIds}
        />
      </CollapsibleSection>

      {!error ? (
        <CollapsibleSection title="圖表分析" subtitle="前 3 大類別、支出分類、付款方式、趨勢">
          <LedgerAnalysis
            analysis={analysis}
            isFamily={isFamily}
            currencyFilter={currencyFilter}
            onSelectCategory={setCategoryTarget}
          />
        </CollapsibleSection>
      ) : null}

      <FAB ledgerType={ledgerType} onSelect={() => setShowForm(true)} />

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

      {searchOpen || categoryTarget ? (
        <TransactionSearchModal
          ledgerType={ledgerType}
          category={categoryTarget}
          onClose={() => {
            setSearchOpen(false);
            setCategoryTarget(null);
          }}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
        />
      ) : null}
    </div>
  );
}
