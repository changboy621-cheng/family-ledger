import { useState } from 'react';
import type { LedgerType } from '../types';
import { currentYearMonth } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useTransactions } from '../hooks/useTransactions';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { useLedgerAnalysis } from '../hooks/useLedgerAnalysis';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { DualCurrencyDisplay } from '../components/common/DualCurrencyDisplay';
import { FamilyInvite } from '../components/family/FamilyInvite';
import { FAB } from '../components/common/FAB';
import { TransactionForm } from '../components/transaction/TransactionForm';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { LedgerAnalysis } from '../components/transaction/LedgerAnalysis';
import { ExpenseBreakdownModal } from '../components/transaction/ExpenseBreakdownModal';
import { TransactionSearchModal, type CategoryDetailTarget } from '../components/transaction/TransactionSearchModal';
import { useUIStore } from '../store/uiStore';

interface CategoryDrillTarget {
  ledgerType: LedgerType;
  target: CategoryDetailTarget;
}

export function Dashboard() {
  const { profile, family } = useAuth();
  const [formLedgerType, setFormLedgerType] = useState<LedgerType | null>(null);
  const [breakdownLedger, setBreakdownLedger] = useState<LedgerType | null>(null);
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
    if (input.ledger_type === 'family') {
      await familyTransactions.createTransaction(input);
    } else {
      await personalTransactions.createTransaction(input);
    }
    showToast('交易已新增');
  }

  // 從圓餅圖／圖表分析下鑽分類明細：開明細前先收掉圓餅圖視窗，避免兩層全螢幕覆蓋層疊在一起。
  function openCategoryDrill(ledgerType: LedgerType, target: CategoryDetailTarget) {
    setBreakdownLedger(null);
    setCategoryDrill({ ledgerType, target });
  }

  const drillLedger = categoryDrill?.ledgerType === 'personal' ? personalTransactions : familyTransactions;

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
          <DualCurrencyDisplay
            title="家庭本月支出"
            values={familySummary.expense}
            onClick={() => setBreakdownLedger('family')}
          />
        )}
        {personalTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-white p-5 text-sm text-slate-600">個人本月支出載入失敗</div>
        ) : (
          <DualCurrencyDisplay
            title="我的個人支出"
            values={personalSummary.expense}
            onClick={() => setBreakdownLedger('personal')}
          />
        )}
      </section>

      {ledgersReady && !hasTransactionThisMonth ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600">
          這個月還沒有交易，點右下角的「＋」記一筆吧！
        </section>
      ) : null}

      {ledgersReady && isSoloFamily ? <FamilyInvite variant="card" /> : null}

      {/* 首頁改以圖表分析為主，家庭／個人各一收合區，預設收合、有需要再打開。 */}
      <div className="grid gap-5">
        {familyTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-white p-5 text-sm text-slate-600">家庭圖表分析載入失敗</div>
        ) : (
          <CollapsibleSection title="家庭圖表分析" subtitle="本月家庭支出的類別與趨勢">
            <LedgerAnalysis
              analysis={familyAnalysis}
              isFamily
              currencyFilter="all"
              onSelectCategory={(target) => openCategoryDrill('family', target)}
            />
          </CollapsibleSection>
        )}

        {personalTransactions.error ? (
          <div className="rounded-xl border border-red-200 bg-white p-5 text-sm text-slate-600">個人圖表分析載入失敗</div>
        ) : (
          <CollapsibleSection title="個人圖表分析" subtitle="本月個人支出的類別與趨勢">
            <LedgerAnalysis
              analysis={personalAnalysis}
              isFamily={false}
              currencyFilter="all"
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

      {breakdownLedger ? (
        <ExpenseBreakdownModal
          title={breakdownLedger === 'family' ? '家庭本月支出分析' : '我的個人本月支出分析'}
          items={(breakdownLedger === 'family' ? familyAnalysis : personalAnalysis).expenseByCategory}
          onClose={() => setBreakdownLedger(null)}
          onSelectCategory={(target) => openCategoryDrill(breakdownLedger, target)}
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
