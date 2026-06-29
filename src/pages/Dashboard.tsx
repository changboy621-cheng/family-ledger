import { useCallback, useMemo, useState } from 'react';
import type { LedgerType, Transaction } from '../types';
import { currentYearMonth } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useTransactions } from '../hooks/useTransactions';
import { usePendingDelete } from '../hooks/usePendingDelete';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { DualCurrencyDisplay } from '../components/common/DualCurrencyDisplay';
import { FamilyInvite } from '../components/family/FamilyInvite';
import { FAB } from '../components/common/FAB';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { TransactionList } from '../components/transaction/TransactionList';
import { useUIStore } from '../store/uiStore';

export function Dashboard() {
  const { profile, family } = useAuth();
  const [formLedgerType, setFormLedgerType] = useState<LedgerType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const yearMonth = currentYearMonth();
  const familyTransactions = useTransactions('family', yearMonth);
  const personalTransactions = useTransactions('personal', yearMonth);
  const familySummary = useMonthlySummary(familyTransactions.transactions);
  const personalSummary = useMonthlySummary(personalTransactions.transactions);
  const familyPending = usePendingDelete(familyTransactions.deleteTransaction);
  const personalPending = usePendingDelete(personalTransactions.deleteTransaction);
  const showToast = useUIStore((state) => state.showToast);
  const { members } = useFamilyMembers();

  // 新使用者引導：資料載入完成且無誤時才判斷，避免載入中誤顯示。
  const ledgersReady =
    !familyTransactions.loading &&
    !personalTransactions.loading &&
    !familyTransactions.error &&
    !personalTransactions.error;
  // 恰為 1 名成員才算 solo：載入中或查詢失敗時 members 為空（length 0），不會誤顯示邀請卡。
  const isSoloFamily = members.length === 1;
  const hasTransactionThisMonth =
    familyTransactions.transactions.length > 0 || personalTransactions.transactions.length > 0;

  const handleSelectEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormLedgerType(transaction.ledger_type);
  }, []);

  const familyRecent = useMemo(
    () => ({ 最近: familyTransactions.transactions.slice(0, 5) }),
    [familyTransactions.transactions]
  );
  const personalRecent = useMemo(
    () => ({ 最近: personalTransactions.transactions.slice(0, 5) }),
    [personalTransactions.transactions]
  );

  async function handleCreate(input: Parameters<typeof familyTransactions.createTransaction>[0]) {
    if (input.ledger_type === 'family') {
      await familyTransactions.createTransaction(input);
    } else {
      await personalTransactions.createTransaction(input);
    }
    showToast('交易已新增');
  }

  async function handleEdit(input: Parameters<typeof familyTransactions.createTransaction>[0]) {
    if (!editingTransaction) return;
    try {
      if (editingTransaction.ledger_type === 'family') {
        await familyTransactions.updateTransaction({ id: editingTransaction.id, ...input });
        await personalTransactions.loadTransactions();
      } else {
        await personalTransactions.updateTransaction({ id: editingTransaction.id, ...input });
        await familyTransactions.loadTransactions();
      }

      showToast('交易已更新');
      setEditingTransaction(null);
      setFormLedgerType(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '更新失敗，請稍後再試。', 'error');
    }
  }

  return (
    <div className="grid gap-6">
      <header className="rounded-xl bg-white p-5">
        <p className="text-sm font-semibold text-slate-500">{family?.name ?? '我們的家'}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">你好，{profile?.display_name ?? '家人'}</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        {familyTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-white p-5 text-sm text-slate-600">家庭本月支出載入失敗</div>
        ) : (
          <DualCurrencyDisplay title="家庭本月支出" values={familySummary.expense} />
        )}
        {personalTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-white p-5 text-sm text-slate-600">個人本月支出載入失敗</div>
        ) : (
          <DualCurrencyDisplay title="我的個人支出" values={personalSummary.expense} />
        )}
      </section>

      {ledgersReady && !hasTransactionThisMonth ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600">
          這個月還沒有交易，點右下角的「＋」記一筆吧！
        </section>
      ) : null}

      {ledgersReady && isSoloFamily ? <FamilyInvite variant="card" /> : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-3">
          <h2 className="text-lg font-bold text-slate-900">最近家庭交易</h2>
          <TransactionList
            groupedTransactions={familyRecent}
            loading={familyTransactions.loading}
            error={familyTransactions.error}
            onRetry={familyTransactions.loadTransactions}
            onDelete={familyPending.requestDelete}
            onEdit={handleSelectEdit}
            hiddenIds={familyPending.pendingIds}
          />
        </div>
        <div className="grid gap-3">
          <h2 className="text-lg font-bold text-slate-900">最近個人交易</h2>
          <TransactionList
            groupedTransactions={personalRecent}
            loading={personalTransactions.loading}
            error={personalTransactions.error}
            onRetry={personalTransactions.loadTransactions}
            onDelete={personalPending.requestDelete}
            onEdit={handleSelectEdit}
            hiddenIds={personalPending.pendingIds}
          />
        </div>
      </section>

      <FAB onSelect={setFormLedgerType} />

      {formLedgerType ? (
        <TransactionForm
          initialLedgerType={formLedgerType}
          initialTransaction={editingTransaction}
          onSubmit={editingTransaction ? handleEdit : handleCreate}
          onClose={() => {
            setFormLedgerType(null);
            setEditingTransaction(null);
          }}
        />
      ) : null}
    </div>
  );
}
