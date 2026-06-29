import { useMemo } from 'react';
import type { Transaction } from '../types';
import { emptyCurrencySummary } from '../lib/currency';

export function useMonthlySummary(transactions: Transaction[]) {
  return useMemo(() => {
    const summary = {
      income: emptyCurrencySummary(),
      expense: emptyCurrencySummary(),
      balance: emptyCurrencySummary()
    };

    for (const transaction of transactions) {
      summary[transaction.type][transaction.currency] += Number(transaction.amount);
    }

    summary.balance.TWD = summary.income.TWD - summary.expense.TWD;
    summary.balance.USD = summary.income.USD - summary.expense.USD;

    return summary;
  }, [transactions]);
}
