import type { Currency } from '../../types';
import type { useLedgerAnalysis } from '../../hooks/useLedgerAnalysis';
import { ExpenseCategorySummary } from './ExpenseCategorySummary';
import { PaymentMethodSummary } from './PaymentMethodSummary';
import { SpenderAnalysis } from './SpenderAnalysis';
import { TopExpenseCategories } from './TopExpenseCategories';
import { ExpenseTrendChart } from './ExpenseTrendChart';

type Analysis = ReturnType<typeof useLedgerAnalysis>;

interface LedgerAnalysisProps {
  analysis: Analysis;
  isFamily: boolean;
  currencyFilter: Currency | 'all';
}

// 帳本的整組圖表分析（前 3 大類別、支出分類、付款方式、花費人、每日/近 6 月趨勢）。
// 由帳本頁與首頁共用，避免兩處重複維護同一套圖表。
export function LedgerAnalysis({ analysis, isFamily, currencyFilter }: LedgerAnalysisProps) {
  return (
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
  );
}
