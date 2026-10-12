import { describe, expect, it } from 'vitest';
import {
  defaultExpenseDate,
  formatRate,
  formatTripAmount,
  parseRate,
  parseTripAmount,
  summarizeTrip,
  toTwd,
  tripCategory,
  tripDays,
  tripExpensesToCsv,
  tripStatus,
  type Trip,
  type TripExpense
} from './trips';
import { parseTripExpenses, parseTrips } from './schemas';

const trip: Trip = {
  id: 't1',
  family_id: 'f1',
  name: '東京',
  start_date: '2026-11-01',
  end_date: '2026-11-05',
  local_currency: 'JPY',
  rate: 0.21,
  budget_twd: 10000
};

function expense(overrides: Partial<TripExpense>): TripExpense {
  return {
    id: 'e',
    trip_id: 't1',
    family_id: 'f1',
    expense_date: '2026-11-01',
    amount: 1000,
    currency: 'JPY',
    rate: 0.21,
    category: 'food',
    ...overrides
  };
}

describe('金額與匯率', () => {
  it('依幣別小數位取整，並支援算式', () => {
    expect(parseTripAmount('1200+380', 'JPY')).toBe(1580);
    expect(parseTripAmount('10.567', 'JPY')).toBe(11);
    expect(parseTripAmount('10.567', 'USD')).toBe(10.57);
    expect(parseTripAmount('', 'JPY')).toBe(0);
    expect(parseTripAmount('5-10', 'JPY')).toBe(0);
  });

  it('匯率需為正數', () => {
    expect(parseRate('0.215')).toBe(0.215);
    expect(parseRate('0')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parseRate('')).toBeNull();
  });

  it('折合新台幣四捨五入', () => {
    expect(toTwd({ amount: 1000, rate: 0.215 })).toBe(215);
    expect(toTwd({ amount: 333, rate: 0.215 })).toBe(72);
  });

  it('格式化金額與匯率', () => {
    expect(formatTripAmount(1580, 'JPY')).toBe('JPY 1,580');
    expect(formatTripAmount(12.5, 'USD')).toBe('USD 12.50');
    expect(formatRate(0.2154321)).toBe('0.215');
    expect(formatRate(0.0012)).toBe('0.0012');
    expect(formatRate(31.5)).toBe('31.5');
  });
});

describe('日期', () => {
  it('旅行天數含頭尾', () => {
    expect(tripDays('2026-11-01', '2026-11-05')).toBe(5);
    expect(tripDays('2026-11-01', '2026-11-01')).toBe(1);
    expect(tripDays('2026-12-30', '2027-01-02')).toBe(4);
  });

  it('預設記帳日落在旅行期間內', () => {
    expect(defaultExpenseDate(trip, '2026-11-03')).toBe('2026-11-03');
    expect(defaultExpenseDate(trip, '2026-10-12')).toBe('2026-11-01');
    expect(defaultExpenseDate(trip, '2026-12-01')).toBe('2026-11-05');
  });

  it('旅行狀態', () => {
    expect(tripStatus(trip, '2026-10-31')).toBe('upcoming');
    expect(tripStatus(trip, '2026-11-01')).toBe('ongoing');
    expect(tripStatus(trip, '2026-11-05')).toBe('ongoing');
    expect(tripStatus(trip, '2026-11-06')).toBe('past');
  });
});

describe('summarizeTrip', () => {
  it('彙總總額、分類、每日、幣別與預算', () => {
    const summary = summarizeTrip(trip, [
      expense({ id: '1', amount: 10000, category: 'food' }),
      expense({ id: '2', amount: 20000, category: 'shopping', expense_date: '2026-11-02' }),
      expense({ id: '3', amount: 10, currency: 'USD', rate: 31, category: 'food', expense_date: '2026-11-02' })
    ]);

    // 2100 + 4200 + 310
    expect(summary.totalTwd).toBe(6610);
    expect(summary.count).toBe(3);
    expect(summary.days).toBe(5);
    expect(summary.perDayTwd).toBe(1322);
    expect(summary.byCategory.map((item) => [item.category.key, item.twd])).toEqual([
      ['shopping', 4200],
      ['food', 2410]
    ]);
    expect(summary.byDay.map((item) => [item.date, item.twd])).toEqual([
      ['2026-11-01', 2100],
      ['2026-11-02', 4510]
    ]);
    expect(summary.byCurrency.map((item) => item.currency)).toEqual(['JPY', 'USD']);
    expect(summary.budgetUsed).toBeCloseTo(0.661);
    expect(summary.budgetLeftTwd).toBe(3390);
  });

  it('沒有花費與沒有預算時的邊界', () => {
    const summary = summarizeTrip({ ...trip, budget_twd: null }, []);
    expect(summary.totalTwd).toBe(0);
    expect(summary.perDayTwd).toBe(0);
    expect(summary.byCategory).toEqual([]);
    expect(summary.budgetUsed).toBeNull();
    expect(summary.budgetLeftTwd).toBeNull();
  });

  it('超支時剩餘為負', () => {
    const summary = summarizeTrip(trip, [expense({ amount: 100000 })]);
    expect(summary.budgetLeftTwd).toBe(-11000);
  });
});

describe('其他', () => {
  it('未知分類退回「其他」', () => {
    expect(tripCategory('nope').key).toBe('other');
  });

  it('CSV 會跳脫逗號與引號', () => {
    const csv = tripExpensesToCsv([expense({ note: 'a,"b"', paid_by: 'u1', payment_method: 'card' })], () => '小明');
    const [header, row] = csv.split('\n');
    expect(header).toContain('折合新台幣');
    expect(row).toBe('2026-11-01,餐飲,1000,JPY,0.21,210,刷卡,小明,"a,""b"""');
  });

  it('schema 把字串數字轉成數字，並丟棄壞列', () => {
    const trips = parseTrips([
      { id: 'a', family_id: 'f', name: 'x', start_date: '2026-11-01', end_date: '2026-11-02', local_currency: 'JPY', rate: '0.21', budget_twd: '5000.00' },
      { id: 'bad', family_id: 'f', name: 'x', start_date: 'oops', end_date: '2026-11-02', local_currency: 'JPY', rate: 1 }
    ]);
    expect(trips).toHaveLength(1);
    expect(trips[0].rate).toBe(0.21);
    expect(trips[0].budget_twd).toBe(5000);

    const expenses = parseTripExpenses([
      { id: 'e', trip_id: 't', family_id: 'f', expense_date: '2026-11-01', amount: '1200.00', currency: 'JPY', rate: '0.21', category: null }
    ]);
    expect(expenses[0].amount).toBe(1200);
    expect(expenses[0].category).toBe('other');
  });
});
