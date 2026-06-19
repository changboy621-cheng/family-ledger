import type { Currency, Transaction, TransactionType } from '../types';

export const currencies: { code: Currency; label: string; symbol: string }[] = [
  { code: 'TWD', label: 'NT$ 新台幣', symbol: 'NT$' },
  { code: 'USD', label: '$ 美金', symbol: '$' }
];

export function formatAmount(amount: number, currency: Currency): string {
  if (currency === 'TWD') {
    return `NT$${Math.round(amount).toLocaleString('zh-TW')}`;
  }

  return `$${Number(amount).toFixed(2)}`;
}

export function getAmountConfig(currency: Currency) {
  return currency === 'TWD'
    ? { step: 1, inputMode: 'numeric' as const, placeholder: '0', decimals: 0 }
    : { step: 0.01, inputMode: 'decimal' as const, placeholder: '0.00', decimals: 2 };
}

export function normalizeAmount(value: string, currency: Currency): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return currency === 'TWD' ? Math.round(parsed) : Math.round(parsed * 100) / 100;
}

export function emptyCurrencySummary() {
  return { TWD: 0, USD: 0 };
}

export function summarizeTransactions(transactions: Transaction[], type?: TransactionType) {
  return transactions
    .filter((transaction) => (type ? transaction.type === type : true))
    .reduce(
      (summary, transaction) => {
        summary[transaction.currency] += Number(transaction.amount);
        return summary;
      },
      { TWD: 0, USD: 0 }
    );
}
