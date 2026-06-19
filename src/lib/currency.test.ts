import { describe, expect, it } from 'vitest';
import { formatAmount, normalizeAmount, sanitizeAmountInput } from './currency';

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

  it('sanitizes input while still allowing users to clear the field', () => {
    expect(sanitizeAmountInput('', 'TWD')).toBe('');
    expect(sanitizeAmountInput('12a3', 'TWD')).toBe('123');
    expect(sanitizeAmountInput('18.999', 'USD')).toBe('18.99');
    expect(sanitizeAmountInput('.', 'USD')).toBe('0.');
  });
});
