import { describe, expect, it } from 'vitest';
import type { RecurringTransaction } from '../types';
import {
  addMonthsToYearMonth,
  buildRecurringTransaction,
  defaultStartMonth,
  describeSchedule,
  formatMonthDay,
  dueMonths,
  MAX_CATCH_UP_MONTHS,
  nextOccurrence,
  occurrenceDate,
  resumedLastGeneratedMonth
} from './recurring';
import { parseRecurringTransactions } from './schemas';

function rule(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 'r1',
    family_id: 'f1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 25000,
    currency: 'TWD',
    category_id: 'rent',
    note: '房租',
    payment_method: null,
    day_of_month: 5,
    start_month: '2026-09',
    last_generated_month: null,
    active: true,
    ...overrides
  };
}

// 2026-09-25
const today = new Date(2026, 8, 25);

describe('occurrenceDate / addMonthsToYearMonth', () => {
  it('短月份記在月底', () => {
    expect(occurrenceDate('2026-02', 31)).toBe('2026-02-28');
    expect(occurrenceDate('2028-02', 30)).toBe('2028-02-29');
    expect(occurrenceDate('2026-09', 5)).toBe('2026-09-05');
  });

  it('跨年加減月份', () => {
    expect(addMonthsToYearMonth('2026-12', 1)).toBe('2027-01');
    expect(addMonthsToYearMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('dueMonths', () => {
  it('本月記入日已到：從起始月記入', () => {
    expect(dueMonths(rule(), today)).toEqual(['2026-09']);
  });

  it('本月記入日未到：不記', () => {
    expect(dueMonths(rule({ day_of_month: 28 }), today)).toEqual([]);
  });

  it('記入日就是今天：記入', () => {
    expect(dueMonths(rule({ day_of_month: 25 }), today)).toEqual(['2026-09']);
  });

  it('已處理過的月份不再產生', () => {
    expect(dueMonths(rule({ last_generated_month: '2026-09' }), today)).toEqual([]);
  });

  it('久未開 App：補記中間漏掉的月份', () => {
    expect(dueMonths(rule({ start_month: '2026-05', last_generated_month: '2026-06' }), today)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09'
    ]);
  });

  it('起始月在未來：不記', () => {
    expect(dueMonths(rule({ start_month: '2026-10' }), today)).toEqual([]);
  });

  it('暫停中不記', () => {
    expect(dueMonths(rule({ active: false }), today)).toEqual([]);
  });

  it(`最多補記 ${MAX_CATCH_UP_MONTHS} 個月（保留最新的）`, () => {
    const months = dueMonths(rule({ start_month: '2023-01' }), today);
    expect(months).toHaveLength(MAX_CATCH_UP_MONTHS);
    expect(months[months.length - 1]).toBe('2026-09');
  });
});

describe('nextOccurrence', () => {
  it('本月已記過 → 下個月', () => {
    expect(nextOccurrence(rule({ last_generated_month: '2026-09' }), today)).toBe('2026-10-05');
  });

  it('本月還沒到 → 本月', () => {
    expect(nextOccurrence(rule({ day_of_month: 28 }), today)).toBe('2026-09-28');
  });

  it('本月到期但尚未產生 → 視為本月處理完，下次是下個月', () => {
    expect(nextOccurrence(rule(), today)).toBe('2026-10-05');
  });

  it('暫停中為 null', () => {
    expect(nextOccurrence(rule({ active: false }), today)).toBeNull();
  });
});

describe('defaultStartMonth', () => {
  it('本月記入日還沒過 → 本月開始', () => {
    expect(defaultStartMonth(28, today)).toBe('2026-09');
    expect(defaultStartMonth(25, today)).toBe('2026-09');
  });

  it('本月記入日已過 → 下個月開始，避免重記', () => {
    expect(defaultStartMonth(5, today)).toBe('2026-10');
  });
});

describe('buildRecurringTransaction', () => {
  it('帶上來源規則、月份與實際記帳人', () => {
    expect(buildRecurringTransaction(rule({ day_of_month: 31 }), '2026-02', 'u2')).toMatchObject({
      owner_id: 'u1',
      recorded_by: 'u2',
      transaction_date: '2026-02-28',
      recurring_id: 'r1',
      recurring_month: '2026-02',
      note: '房租'
    });
  });
});

describe('formatMonthDay', () => {
  it('去掉年份與前導零', () => {
    expect(formatMonthDay('2026-10-05')).toBe('10/5');
  });
});

describe('describeSchedule', () => {
  it('29 號以後註明短月份處理', () => {
    expect(describeSchedule(5)).toBe('每月 5 號');
    expect(describeSchedule(31)).toContain('月底');
  });
});

describe('parseRecurringTransactions', () => {
  it('numeric 轉數字、char(7) 去空白、壞月份整列丟棄', () => {
    const rows = parseRecurringTransactions([
      { ...rule(), amount: '25000.00', start_month: '2026-09 ', last_generated_month: null },
      { ...rule({ id: 'bad' }), start_month: 'oops' }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(25000);
    expect(rows[0].start_month).toBe('2026-09');
  });
});

describe('resumedLastGeneratedMonth', () => {
  it('暫停期間的月份不補記：推進到上個月', () => {
    expect(resumedLastGeneratedMonth({ start_month: '2026-03', last_generated_month: '2026-06' }, today)).toBe('2026-08');
  });

  it('從未產生過且起始月已過：同樣推進到上個月', () => {
    expect(resumedLastGeneratedMonth({ start_month: '2026-03', last_generated_month: null }, today)).toBe('2026-08');
  });

  it('起始月在本月或之後、或已處理到上個月以後：不調整', () => {
    expect(resumedLastGeneratedMonth({ start_month: '2026-09', last_generated_month: null }, today)).toBeNull();
    expect(resumedLastGeneratedMonth({ start_month: '2026-03', last_generated_month: '2026-09' }, today)).toBeNull();
  });
});
