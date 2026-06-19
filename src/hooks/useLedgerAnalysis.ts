import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { useMemo } from 'react';
import type {
  CategoryExpenseSummary,
  CurrencySummary,
  DailyExpensePoint,
  LedgerAnalysis,
  MonthlyExpensePoint,
  MonthlySummary,
  OwnerExpenseSummary,
  Transaction
} from '../types';

function emptyCurrencySummary(): CurrencySummary {
  return { TWD: 0, USD: 0 };
}

function emptyMonthlySummary(): MonthlySummary {
  return {
    income: emptyCurrencySummary(),
    expense: emptyCurrencySummary(),
    balance: emptyCurrencySummary()
  };
}

function totalValue(totals: CurrencySummary) {
  return totals.TWD + totals.USD;
}

function calculateRatio(amount: number, total: number) {
  if (total <= 0) return 0;
  return amount / total;
}

function createDailyTrend(yearMonth: string): DailyExpensePoint[] {
  const start = parseISO(`${yearMonth}-01`);
  const end = endOfMonth(start);

  return eachDayOfInterval({ start, end }).map((date) => ({
    date: format(date, 'yyyy-MM-dd'),
    day: Number(format(date, 'd')),
    totals: emptyCurrencySummary()
  }));
}

function createMonthlyTrend(yearMonth: string): MonthlyExpensePoint[] {
  const end = parseISO(`${yearMonth}-01`);

  return Array.from({ length: 6 }, (_, index) => {
    const date = addMonths(end, index - 5);
    return {
      yearMonth: format(date, 'yyyy-MM'),
      label: format(date, 'M月'),
      totals: emptyCurrencySummary()
    };
  });
}

export function analyzeLedgerTransactions(transactions: Transaction[], yearMonth: string): LedgerAnalysis {
  const summary = emptyMonthlySummary();
  const categories = new Map<string, CategoryExpenseSummary>();
  const owners = new Map<string, OwnerExpenseSummary>();
  const dailyExpenseTrend = createDailyTrend(yearMonth);
  const monthlyExpenseTrend = createMonthlyTrend(yearMonth);
  const dailyMap = new Map(dailyExpenseTrend.map((point) => [point.date, point]));
  const monthlyMap = new Map(monthlyExpenseTrend.map((point) => [point.yearMonth, point]));
  const selectedMonthStart = startOfMonth(parseISO(`${yearMonth}-01`));
  const selectedMonthEnd = endOfMonth(selectedMonthStart);

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    const transactionDate = parseISO(transaction.transaction_date);
    const transactionYearMonth = format(transactionDate, 'yyyy-MM');

    if (transaction.type === 'expense' && monthlyMap.has(transactionYearMonth)) {
      monthlyMap.get(transactionYearMonth)!.totals[transaction.currency] += amount;
    }

    if (transactionDate < selectedMonthStart || transactionDate > selectedMonthEnd) {
      continue;
    }

    summary[transaction.type][transaction.currency] += amount;

    if (transaction.type !== 'expense') continue;

    const dailyPoint = dailyMap.get(transaction.transaction_date);
    if (dailyPoint) {
      dailyPoint.totals[transaction.currency] += amount;
    }

    const categoryKey = transaction.category_id;
    const existingCategory = categories.get(categoryKey) ?? {
      categoryId: categoryKey,
      categoryName: transaction.category?.name ?? '未分類',
      categoryIcon: transaction.category?.icon ?? '•',
      totals: emptyCurrencySummary(),
      ratios: emptyCurrencySummary()
    };
    existingCategory.totals[transaction.currency] += amount;
    categories.set(categoryKey, existingCategory);

    const ownerKey = transaction.owner_id;
    const existingOwner = owners.get(ownerKey) ?? {
      ownerId: ownerKey,
      ownerName: transaction.owner?.display_name ?? '未命名成員',
      avatarColor: transaction.owner?.avatar_color ?? '#64748B',
      totals: emptyCurrencySummary(),
      ratios: emptyCurrencySummary(),
      categories: []
    };
    existingOwner.totals[transaction.currency] += amount;

    const ownerCategory =
      existingOwner.categories.find((item) => item.categoryId === categoryKey) ?? {
        categoryId: categoryKey,
        categoryName: transaction.category?.name ?? '未分類',
        categoryIcon: transaction.category?.icon ?? '•',
        totals: emptyCurrencySummary(),
        ratios: emptyCurrencySummary()
      };
    ownerCategory.totals[transaction.currency] += amount;

    if (!existingOwner.categories.some((item) => item.categoryId === categoryKey)) {
      existingOwner.categories.push(ownerCategory);
    }

    owners.set(ownerKey, existingOwner);
  }

  summary.balance.TWD = summary.income.TWD - summary.expense.TWD;
  summary.balance.USD = summary.income.USD - summary.expense.USD;

  const expenseByCategory = [...categories.values()]
    .map((category) => ({
      ...category,
      ratios: {
        TWD: calculateRatio(category.totals.TWD, summary.expense.TWD),
        USD: calculateRatio(category.totals.USD, summary.expense.USD)
      }
    }))
    .sort((left, right) => totalValue(right.totals) - totalValue(left.totals));
  const topCategories = expenseByCategory.slice(0, 3);
  const expenseByOwner = [...owners.values()]
    .map((owner) => ({
      ...owner,
      ratios: {
        TWD: calculateRatio(owner.totals.TWD, summary.expense.TWD),
        USD: calculateRatio(owner.totals.USD, summary.expense.USD)
      },
      categories: [...owner.categories].sort((left, right) => totalValue(right.totals) - totalValue(left.totals))
        .map((category) => ({
          ...category,
          ratios: {
            TWD: calculateRatio(category.totals.TWD, summary.expense.TWD),
            USD: calculateRatio(category.totals.USD, summary.expense.USD)
          }
        }))
    }))
    .sort((left, right) => totalValue(right.totals) - totalValue(left.totals));

  return {
    summary,
    topCategories,
    expenseByCategory,
    expenseByOwner,
    dailyExpenseTrend,
    monthlyExpenseTrend
  };
}

export function useLedgerAnalysis(transactions: Transaction[], yearMonth: string) {
  return useMemo(() => analyzeLedgerTransactions(transactions, yearMonth), [transactions, yearMonth]);
}
