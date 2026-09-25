import type { Budget, Currency, LedgerType, MonthlySummary, Transaction } from '../types';

// 預算與儲蓄率的純函式。預算以「生效月份」沿用：某月設定後，之後每月沿用，
// 直到再次調整為止（寫入新月份的列）；金額 0 代表自該月起取消。

/** 用到預算的幾成開始提醒（黃色）。 */
export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  ratio: number;
  status: BudgetStatus;
}

function budgetKey(budget: Pick<Budget, 'ledger_type' | 'owner_id' | 'category_id' | 'currency'>) {
  return [budget.ledger_type, budget.owner_id ?? '', budget.category_id ?? '', budget.currency].join('|');
}

/**
 * 取出指定月份實際生效的預算：同一組（帳本／擁有者／類別／幣別）取 year_month ≤ 該月的最新一筆，
 * 金額為 0（已取消）者不列入。總預算（category_id 為 null）排在最前。
 */
export function resolveEffectiveBudgets(rows: Budget[], yearMonth: string): Budget[] {
  const latest = new Map<string, Budget>();
  for (const row of rows) {
    if (row.year_month > yearMonth) continue;
    const key = budgetKey(row);
    const current = latest.get(key);
    if (!current || row.year_month > current.year_month) latest.set(key, row);
  }

  return [...latest.values()]
    .filter((budget) => budget.amount > 0)
    .sort((a, b) => Number(a.category_id !== null) - Number(b.category_id !== null));
}

export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return 'over';
  if (ratio >= BUDGET_WARNING_RATIO) return 'warning';
  return 'ok';
}

/** 依當月交易計算每筆預算的使用進度（只算支出、同幣別；類別預算只算該類別）。 */
export function computeBudgetProgress(budgets: Budget[], transactions: Transaction[]): BudgetProgress[] {
  return budgets.map((budget) => {
    const spent = transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.currency === budget.currency &&
          (budget.category_id === null || transaction.category_id === budget.category_id)
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const ratio = budget.amount > 0 ? spent / budget.amount : 0;
    return { budget, spent, ratio, status: budgetStatus(ratio) };
  });
}

/** 篩出某帳本的預算；個人預算只取本人的。 */
export function budgetsForLedger(budgets: Budget[], ledgerType: LedgerType, profileId: string): Budget[] {
  return budgets.filter((budget) =>
    ledgerType === 'family'
      ? budget.ledger_type === 'family'
      : budget.ledger_type === 'personal' && budget.owner_id === profileId
  );
}

/** 找出設定畫面某一格（帳本／類別／幣別）目前生效的預算金額，沒有則為 null。 */
export function findBudgetAmount(
  budgets: Budget[],
  ledgerType: LedgerType,
  categoryId: string | null,
  currency: Currency
): number | null {
  const match = budgets.find(
    (budget) => budget.ledger_type === ledgerType && budget.category_id === categoryId && budget.currency === currency
  );
  return match ? match.amount : null;
}

export interface SavingsFigures {
  income: number;
  expense: number;
  balance: number;
  /** 儲蓄率 =（收入 − 支出）÷ 收入；沒有收入時為 null。 */
  rate: number | null;
}

export function computeSavings(summary: MonthlySummary, currency: Currency): SavingsFigures {
  const income = summary.income[currency];
  const expense = summary.expense[currency];
  const balance = income - expense;
  return { income, expense, balance, rate: income > 0 ? balance / income : null };
}

/** 把多個帳本的月摘要加總（例如家庭＋個人 = 合計）。 */
export function combineSummaries(...summaries: MonthlySummary[]): MonthlySummary {
  const total: MonthlySummary = {
    income: { TWD: 0, USD: 0 },
    expense: { TWD: 0, USD: 0 },
    balance: { TWD: 0, USD: 0 }
  };
  for (const summary of summaries) {
    for (const field of ['income', 'expense', 'balance'] as const) {
      total[field].TWD += summary[field].TWD;
      total[field].USD += summary[field].USD;
    }
  }
  return total;
}

/** 儲蓄率的健康度：≥ 20% 良好、0–20% 普通、負值代表入不敷出。 */
export const HEALTHY_SAVINGS_RATE = 0.2;

export function savingsTone(rate: number | null): 'good' | 'fair' | 'bad' | 'none' {
  if (rate === null) return 'none';
  if (rate < 0) return 'bad';
  if (rate < HEALTHY_SAVINGS_RATE) return 'fair';
  return 'good';
}

/** 本月已經過的比例（含今天），例如 30 天的月份第 15 天 = 0.5。 */
export function monthElapsedRatio(now: Date = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() / daysInMonth;
}

/** 設定畫面輸入的預算金額：空白＝取消（0）；非數字或負數回傳 null（無效）。 */
export function parseBudgetInput(raw: string, currency: Currency): number | null {
  const text = raw.replace(/,/g, '').trim();
  if (text === '') return 0;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return currency === 'TWD' ? Math.round(value) : Math.round(value * 100) / 100;
}
