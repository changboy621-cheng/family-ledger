import { describe, expect, it } from 'vitest';
import { formatAmount, normalizeAmount } from './currency';

describe('currency helpers', () => {
  it('formats TWD as rounded whole dollars', () => {
    expect(formatAmount(28450.4, 'TWD')).toBe('NT$28,450');
  });

  it('formats USD with two decimals', () => {
    expect(formatAmount(320, 'USD')).toBe('$320.00');
  });

  it('normalizes TWD to integers and USD to two decimals', () => {
    expect(normalizeAmount('850.8', 'TWD')).toBe(851);
    expect(normalizeAmount('26.505', 'USD')).toBe(26.51);
  });
});
