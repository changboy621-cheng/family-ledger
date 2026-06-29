import type { Currency } from '../types';
import { CURRENCIES } from './currency';

// 分析摘要元件共用的呈現輔助，取代原本 5 個元件各自複製的同名函式。

export function visibleCurrencies(currencyFilter: Currency | 'all'): Currency[] {
  return currencyFilter === 'all' ? [...CURRENCIES] : [currencyFilter];
}

export function formatRatio(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** 比例條寬度（%）：有金額時至少給 6% 寬，讓極小占比仍可見。 */
export function ratioBarWidth(ratio: number): number {
  return Math.max(ratio * 100, ratio > 0 ? 6 : 0);
}
