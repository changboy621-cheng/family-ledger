import type { Currency, CurrencySummary } from '../types';
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

export function normalizeAmount(value: string, currency: Currency): number {
  const parsed = evaluateExpression(value);
  if (parsed === null || parsed <= 0) return 0;
  return currency === 'TWD' ? Math.round(parsed) : Math.round(parsed * 100) / 100;
}

/** 雙幣別零彙總的單一來源（取代 useLedgerAnalysis 的本地版與 useMonthlySummary 的內聯字面值）。 */
export function emptyCurrencySummary(): CurrencySummary {
  return { TWD: 0, USD: 0 };
}
