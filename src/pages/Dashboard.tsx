import { useState } from 'react';
import type { LedgerType } from '../types';
import { currentYearMonth } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { createdToastMessage, useTransactions } from '../hooks/useTransactions';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { useLedgerAnalysis } from '../hooks/useLedgerAnalysis';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { DualCurrencyDisplay } from '../components/common/DualCurrencyDisplay';
import { FamilyInvite } from '../components/family/FamilyInvite';
import { FAB } from '../components/common/FAB';
import { saveLastLedgerType } from '../lib/lastLedger';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { LedgerAnalysis } from '../components/transaction/LedgerAnalysis';
import { TransactionSearchModal, type CategoryDetailTarget } from '../components/transaction/TransactionSearchModal';
import { useUIStore } from '../store/uiStore';
import { useBudgets } from '../hooks/useBudgets';
import { useCategories } from '../hooks/useCategories';
import { monthElapsedRatio } from '../lib/budget';
import { SavingsCard } from '../components/budget/SavingsCard';
import { BudgetProgressCard } from '../components/budget/BudgetProgressCard';
import { DashboardShortcuts } from '../components/budget/DashboardShortcuts';

interface CategoryDrillTarget {
  ledgerType: LedgerType;
  target: CategoryDetailTarget;
}

export function Dashboard() {
  const { profile, family } = useAuth();
  const [formLedgerType, setFormLedgerType] = useState<LedgerType | null>(null);
  const [categoryDrill, setCategoryDrill] = useState<CategoryDrillTarget | null>(null);
  const yearMonth = currentYearMonth();
  const familyTransactions = useTransactions('family', yearMonth);
  const personalTransactions = useTransactions('personal', yearMonth);
  const familySummary = useMonthlySummary(familyTransactions.transactions);
  const personalSummary = useMonthlySummary(personalTransactions.transactions);
  const familyAnalysis = useLedgerAnalysis(familyTransactions.transactions, yearMonth);
  const personalAnalysis = useLedgerAnalysis(personalTransactions.transactions, yearMonth);
  const showToast = useUIStore((state) => state.showToast);
  const { members } = useFamilyMembers();
  const { budgets } = useBudgets(yearMonth);
  const { categories: expenseCategories } = useCategories('expense');

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

  async function handleCreate(input: Parameters<typeof familyTransactions.createTransaction>[0]) {
    saveLastLedgerType(input.ledger_type);
    const ledger = input.ledger_type === 'family' ? familyTransactions : personalTransactions;
    showToast(createdToastMessage(await ledger.createTransaction(input)));
  }

  // 從圖表分析的圓餅圖／支出分類下鑽，開啟該類別的交易明細。
  function openCategoryDrill(ledgerType: LedgerType, target: CategoryDetailTarget) {
    setCategoryDrill({ ledgerType, target });
  }

  const drillLedger = categoryDrill?.ledgerType === 'personal' ? personalTransactions : familyTransactions;

  return (
    <div className="grid gap-6">
      <header className="pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">你好，{profile?.display_name ?? '家人'}</h1>
        <p className="mt-1 text-sm text-slate-500">{family?.name ?? '我們的家'} · 這個月的花費都在這裡</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {familyTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-card p-5 text-sm text-slate-600">家庭本月支出載入失敗</div>
        ) : (
          <DualCurrencyDisplay title="家庭本月支出" values={familySummary.expense} tone="family" />
        )}
        {personalTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-card p-5 text-sm text-slate-600">個人本月支出載入失敗</div>
        ) : (
          <DualCurrencyDisplay title="我的個人支出" values={personalSummary.expense} tone="personal" />
        )}
      </section>

      <DashboardShortcuts />

      {ledgersReady && profile ? (
        <section className="grid gap-3 md:grid-cols-2">
          <SavingsCard familySummary={familySummary} personalSummary={personalSummary} />
          <BudgetProgressCard
            budgets={budgets}
            profileId={profile.id}
            familyTransactions={familyTransactions.transactions}
            personalTransactions={personalTransactions.transactions}
            categories={expenseCategories}
            monthElapsed={monthElapsedRatio()}
          />
        </section>
      ) : null}

      {ledgersReady && !hasTransactionThisMonth ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-card p-5 text-center text-sm text-slate-600">
          這個月還沒有交易，點右下角的「＋」記一筆吧！
        </section>
      ) : null}

      {ledgersReady && isSoloFamily ? <FamilyInvite variant="card" /> : null}

      {/* 首頁改以圖表分析為主，家庭／個人各一收合區，預設收合、有需要再打開。 */}
      <div className="grid gap-5">
        {familyTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-card p-5 text-sm text-slate-600">家庭圖表分析載入失敗</div>
        ) : (
          <CollapsibleSection title="家庭圖表分析" subtitle="本月家庭支出的類別與趨勢">
            <LedgerAnalysis
              analysis={familyAnalysis}
              isFamily
              currencyFilter="all"
              yearMonth={yearMonth}
              onSelectCategory={(target) => openCategoryDrill('family', target)}
            />
          </CollapsibleSection>
        )}

        {personalTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-card p-5 text-sm text-slate-600">個人圖表分析載入失敗</div>
        ) : (
          <CollapsibleSection title="個人圖表分析" subtitle="本月個人支出的類別與趨勢">
            <LedgerAnalysis
              analysis={personalAnalysis}
              isFamily={false}
              currencyFilter="all"
              yearMonth={yearMonth}
              onSelectCategory={(target) => openCategoryDrill('personal', target)}
            />
          </CollapsibleSection>
        )}
      </div>

      <FAB onSelect={setFormLedgerType} />

      {formLedgerType ? (
        <TransactionForm
          initialLedgerType={formLedgerType}
          onSubmit={handleCreate}
          onClose={() => setFormLedgerType(null)}
        />
      ) : null}

      {categoryDrill ? (
        <TransactionSearchModal
          ledgerType={categoryDrill.ledgerType}
          category={categoryDrill.target}
          onClose={() => setCategoryDrill(null)}
          onUpdate={drillLedger.updateTransaction}
          onDelete={drillLedger.deleteTransaction}
        />
      ) : null}
    </div>
  );
}
