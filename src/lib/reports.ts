import type { Currency, Transaction } from '../types';

/** 報表一律以單一幣別計算（預設新台幣），不同幣別不混加。 */
export interface MonthTotals {
  month: string; // YYYY-MM
  income: number;
  expense: number;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string;
  total: number;
}

export interface YearReport {
  year: number;
  months: MonthTotals[];
  income: number;
  expense: number;
  balance: number;
  /** 結餘 ÷ 收入；沒有收入時為 null。 */
  savingsRate: number | null;
  categories: CategoryTotal[];
  topExpenses: Transaction[];
}

const round = (value: number) => Math.round(value * 100) / 100;

function inCurrency(transactions: Transaction[], currency: Currency) {
  return transactions.filter((transaction) => transaction.currency === currency);
}

function categoryTotals(transactions: Transaction[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const current = map.get(transaction.category_id) ?? {
      categoryId: transaction.category_id,
      name: transaction.category?.name ?? '未分類',
      icon: transaction.category?.icon ?? '•',
      total: 0
    };
    current.total = round(current.total + Number(transaction.amount));
    map.set(transaction.category_id, current);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildYearReport(transactions: Transaction[], year: number, currency: Currency = 'TWD'): YearReport {
  const prefix = `${year}-`;
  const rows = inCurrency(transactions, currency).filter((transaction) => transaction.transaction_date.startsWith(prefix));
  const months: MonthTotals[] = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    income: 0,
    expense: 0
  }));
  for (const transaction of rows) {
    const bucket = months[Number(transaction.transaction_date.slice(5, 7)) - 1];
    if (!bucket) continue;
    if (transaction.type === 'income') bucket.income = round(bucket.income + Number(transaction.amount));
    else bucket.expense = round(bucket.expense + Number(transaction.amount));
  }
  const income = round(months.reduce((sum, month) => sum + month.income, 0));
  const expense = round(months.reduce((sum, month) => sum + month.expense, 0));
  const balance = round(income - expense);
  return {
    year,
    months,
    income,
    expense,
    balance,
    savingsRate: income > 0 ? balance / income : null,
    categories: categoryTotals(rows),
    topExpenses: rows
      .filter((transaction) => transaction.type === 'expense')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
  };
}

export interface CategoryComparison {
  categoryId: string;
  name: string;
  icon: string;
  current: number;
  lastMonth: number;
  lastYear: number;
  /** 與上月相比的變化比例；上月為 0 時為 null。 */
  vsLastMonth: number | null;
  vsLastYear: number | null;
  /** 變化明顯：比上月多或少 30% 以上，且差額至少 threshold。 */
  notable: 'up' | 'down' | null;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 某月每個支出分類：本月、上月、去年同月。依本月金額排序，本月為 0 但上月有花的也列出。 */
export function compareMonth(
  transactions: Transaction[],
  month: string,
  currency: Currency = 'TWD',
  threshold = 500
): { rows: CategoryComparison[]; totals: { current: number; lastMonth: number; lastYear: number } } {
  const rows = inCurrency(transactions, currency);
  const previous = shiftMonth(month, -1);
  const lastYear = shiftMonth(month, -12);
  const pick = (target: string) => categoryTotals(rows.filter((transaction) => transaction.transaction_date.startsWith(target)));
  const current = pick(month);
  const prev = pick(previous);
  const year = pick(lastYear);
  const ids = new Set([...current, ...prev].map((item) => item.categoryId));
  const find = (list: CategoryTotal[], id: string) => list.find((item) => item.categoryId === id);
  const ratio = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

  const result = [...ids].map((id) => {
    const info = find(current, id) ?? find(prev, id) ?? find(year, id)!;
    const now = find(current, id)?.total ?? 0;
    const before = find(prev, id)?.total ?? 0;
    const yearAgo = find(year, id)?.total ?? 0;
    const change = ratio(now, before);
    const diff = now - before;
    const notable =
      Math.abs(diff) >= threshold && (change === null || Math.abs(change) >= 0.3) ? (diff > 0 ? 'up' : 'down') : null;
    return {
      categoryId: id,
      name: info.name,
      icon: info.icon,
      current: now,
      lastMonth: before,
      lastYear: yearAgo,
      vsLastMonth: change,
      vsLastYear: ratio(now, yearAgo),
      notable
    } satisfies CategoryComparison;
  });
  result.sort((a, b) => b.current - a.current || b.lastMonth - a.lastMonth);
  const sum = (list: CategoryTotal[]) => round(list.reduce((total, item) => total + item.total, 0));
  return { rows: result, totals: { current: sum(current), lastMonth: sum(prev), lastYear: sum(year) } };
}
