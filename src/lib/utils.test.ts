import { describe, expect, it } from 'vitest';
import { monthRange, rollingMonthRange } from './utils';

// 這些斷言在任何時區都必須成立（過去用 toISOString 會在 UTC+ 時區失敗）。
describe('monthRange', () => {
  it('涵蓋整個月份，包含最後一天', () => {
    expect(monthRange('2026-06')).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('正確處理跨年 1 月與含閏日的 2 月', () => {
    expect(monthRange('2026-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
});

describe('rollingMonthRange', () => {
  it('to 涵蓋當月最後一天（過去 toISOString 在 UTC+ 時區會少一天）', () => {
    expect(rollingMonthRange('2026-06', 5)).toEqual({ from: '2026-02-01', to: '2026-06-30' });
  });

  it('跨年回看', () => {
    expect(rollingMonthRange('2026-02', 5)).toEqual({ from: '2025-10-01', to: '2026-02-28' });
  });
});
