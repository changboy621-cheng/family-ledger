import { describe, expect, it } from 'vitest';
import { MAX_DISPLAY_NAME_LENGTH, isValidDisplayName, normalizeDisplayName } from './profile';

describe('normalizeDisplayName', () => {
  it('去除前後空白', () => {
    expect(normalizeDisplayName('  老婆  ')).toBe('老婆');
  });

  it('把連續空白收斂成單一空白', () => {
    expect(normalizeDisplayName('王  小明')).toBe('王 小明');
  });

  it('超過長度上限時截斷', () => {
    const long = 'a'.repeat(MAX_DISPLAY_NAME_LENGTH + 5);
    expect(normalizeDisplayName(long)).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
  });
});

describe('isValidDisplayName', () => {
  it('正常名稱為有效', () => {
    expect(isValidDisplayName('老公')).toBe(true);
  });

  it('全空白為無效', () => {
    expect(isValidDisplayName('   ')).toBe(false);
  });

  it('空字串為無效', () => {
    expect(isValidDisplayName('')).toBe(false);
  });
});
