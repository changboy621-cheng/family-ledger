import { useMemo } from 'react';
import type { Transaction } from '../types';

export function useMonthlySummary(transactions: Transaction[]) {
  return useMemo(() => {
    const summary = {
      income: { TWD: 0, USD: 0 },
      expense: { TWD: 0, USD: 0 },
      balance: { TWD: 0, USD: 0 }
    };

    for (const transaction of transactions) {
      summary[transaction.type][transaction.currency] += Number(transaction.amount);
    }

    summary.balance.TWD = summary.income.TWD - summary.expense.TWD;
    summary.balance.USD = summary.income.USD - summary.expense.USD;

    return summary;
  }, [transactions]);
}
