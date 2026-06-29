import type { Currency, Transaction, TransactionType } from '../types';
import { evaluateExpression } from './expression';

// 所有支援幣別的單一來源，取代各處 `(['TWD','USD'] as Currency[])` 的重複轉型。
export const CURRENCIES: readonly Currency[] = ['TWD', 'USD'];

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

export function sanitizeAmountInput(value: string, currency: Currency): string {
  if (!value) return '';

  const normalized = value.replace(/,/g, '').trim();

  if (currency === 'TWD') {
    return normalized.replace(/\D/g, '');
  }

  const cleaned = normalized.replace(/[^0-9.]/g, '');
  const [integerPart = '', ...decimalParts] = cleaned.split('.');
  const decimals = decimalParts.join('').slice(0, 2);

  if (cleaned.startsWith('.')) {
    return decimals ? `0.${decimals}` : '0.';
  }

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimals}`;
}

export function normalizeAmount(value: string, currency: Currency): number {
  const parsed = evaluateExpression(value);
  if (parsed === null || parsed <= 0) return 0;
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
