import type { PaymentMethod } from '../types';
import { evaluateExpression } from './expression';

// 旅遊記帳的純邏輯：幣別、分類、金額換算與彙總。UI 與資料存取不在這裡。

export interface Trip {
  id: string;
  family_id: string;
  created_by?: string | null;
  name: string;
  destination?: string | null;
  start_date: string;
  end_date: string;
  /** 當地主要幣別（ISO 4217）。 */
  local_currency: string;
  /** 預設匯率：1 單位當地幣 = rate 新台幣。 */
  rate: number;
  budget_twd?: number | null;
}

export interface TripExpense {
  id: string;
  trip_id: string;
  family_id: string;
  paid_by?: string | null;
  recorded_by?: string | null;
  expense_date: string;
  amount: number;
  currency: string;
  /** 記帳當下：1 單位 currency = rate 新台幣。 */
  rate: number;
  category: string;
  payment_method?: PaymentMethod | null;
  note?: string | null;
  /** 消費地點（可選），與家庭／個人記帳的定位一起顯示在消費地圖。 */
  latitude?: number | null;
  longitude?: number | null;
  place_name?: string | null;
}

export interface TripCurrency {
  code: string;
  label: string;
  /** 小數位數（日圓、韓元、越南盾沒有小數）。 */
  decimals: number;
  /** 僅供建立旅行時預填的參考匯率（約略值），請使用者依實際匯率修改。 */
  hintRate: number;
}

export const TRIP_CURRENCIES: readonly TripCurrency[] = [
  { code: 'TWD', label: 'TWD 新台幣', decimals: 0, hintRate: 1 },
  { code: 'JPY', label: 'JPY 日圓', decimals: 0, hintRate: 0.21 },
  { code: 'KRW', label: 'KRW 韓元', decimals: 0, hintRate: 0.023 },
  { code: 'USD', label: 'USD 美元', decimals: 2, hintRate: 31 },
  { code: 'EUR', label: 'EUR 歐元', decimals: 2, hintRate: 35 },
  { code: 'GBP', label: 'GBP 英鎊', decimals: 2, hintRate: 41 },
  { code: 'CNY', label: 'CNY 人民幣', decimals: 2, hintRate: 4.3 },
  { code: 'HKD', label: 'HKD 港幣', decimals: 2, hintRate: 4 },
  { code: 'SGD', label: 'SGD 新加坡幣', decimals: 2, hintRate: 24 },
  { code: 'THB', label: 'THB 泰銖', decimals: 2, hintRate: 0.9 },
  { code: 'MYR', label: 'MYR 馬來幣', decimals: 2, hintRate: 7.3 },
  { code: 'VND', label: 'VND 越南盾', decimals: 0, hintRate: 0.0012 },
  { code: 'AUD', label: 'AUD 澳幣', decimals: 2, hintRate: 21 }
];

const CURRENCY_BY_CODE = new Map(TRIP_CURRENCIES.map((currency) => [currency.code, currency]));

export function tripCurrency(code: string): TripCurrency {
  return CURRENCY_BY_CODE.get(code) ?? { code, label: code, decimals: 2, hintRate: 1 };
}

export interface TripCategory {
  key: string;
  label: string;
  icon: string;
}

export const TRIP_CATEGORIES: readonly TripCategory[] = [
  { key: 'food', label: '餐飲', icon: '🍜' },
  { key: 'transport', label: '交通', icon: '🚆' },
  { key: 'lodging', label: '住宿', icon: '🏨' },
  { key: 'shopping', label: '購物', icon: '🛍️' },
  { key: 'sightseeing', label: '門票娛樂', icon: '🎟️' },
  { key: 'snack', label: '點心飲料', icon: '🧋' },
  { key: 'souvenir', label: '伴手禮', icon: '🎁' },
  { key: 'other', label: '其他', icon: '🧾' }
];

const CATEGORY_BY_KEY = new Map(TRIP_CATEGORIES.map((category) => [category.key, category]));

/** 未知分類（舊資料或自訂）一律顯示為「其他」。 */
export function tripCategory(key: string): TripCategory {
  return CATEGORY_BY_KEY.get(key) ?? (CATEGORY_BY_KEY.get('other') as TripCategory);
}

/** 解析金額輸入（支援 120+80 算式），依幣別小數位取整；無效回傳 0。 */
export function parseTripAmount(value: string, currencyCode: string): number {
  const parsed = evaluateExpression(value);
  if (parsed === null || parsed <= 0) return 0;
  const factor = 10 ** tripCurrency(currencyCode).decimals;
  return Math.round(parsed * factor) / factor;
}

/** 解析匯率輸入；無效或 ≤ 0 回傳 null。 */
export function parseRate(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** 這筆花費折合新台幣（四捨五入到整數元）。 */
export function toTwd(expense: Pick<TripExpense, 'amount' | 'rate'>): number {
  return Math.round(expense.amount * expense.rate);
}

export function formatTripAmount(amount: number, currencyCode: string): string {
  const { decimals } = tripCurrency(currencyCode);
  return `${currencyCode} ${amount.toLocaleString('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

export function formatTwd(amount: number): string {
  return `NT$${Math.round(amount).toLocaleString('zh-TW')}`;
}

/** 匯率顯示：小匯率（韓元、越南盾）多留幾位避免顯示成 0。 */
export function formatRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) return String(Number(rate.toFixed(4)));
  return String(Number(rate.toPrecision(3)));
}

export interface TripCategoryTotal {
  category: TripCategory;
  twd: number;
  count: number;
  ratio: number;
}

export interface TripDayTotal {
  date: string;
  twd: number;
  count: number;
}

export interface TripCurrencyTotal {
  currency: string;
  /** 該幣別的原幣合計。 */
  amount: number;
  twd: number;
}

export interface TripSummary {
  totalTwd: number;
  count: number;
  /** 旅行天數（含頭尾）。 */
  days: number;
  /** 平均每日（以「有花費的天數」或旅行天數取較大者，避免只記一天時被誤導）。 */
  perDayTwd: number;
  byCategory: TripCategoryTotal[];
  byDay: TripDayTotal[];
  byCurrency: TripCurrencyTotal[];
  /** 預算使用比例（0–1+）；沒設預算為 null。 */
  budgetUsed: number | null;
  budgetLeftTwd: number | null;
}

/** 兩個 YYYY-MM-DD 之間含頭尾的天數（至少 1）。以 UTC 計算避免夏令時間偏差。 */
export function tripDays(startDate: string, endDate: string): number {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const diff = Math.round((toUtc(endDate) - toUtc(startDate)) / 86_400_000);
  return Math.max(1, diff + 1);
}

export function summarizeTrip(trip: Trip, expenses: TripExpense[]): TripSummary {
  let totalTwd = 0;
  const categories = new Map<string, { twd: number; count: number }>();
  const days = new Map<string, { twd: number; count: number }>();
  const currencies = new Map<string, { amount: number; twd: number }>();

  for (const expense of expenses) {
    const twd = toTwd(expense);
    totalTwd += twd;

    const category = categories.get(expense.category) ?? { twd: 0, count: 0 };
    category.twd += twd;
    category.count += 1;
    categories.set(expense.category, category);

    const day = days.get(expense.expense_date) ?? { twd: 0, count: 0 };
    day.twd += twd;
    day.count += 1;
    days.set(expense.expense_date, day);

    const currency = currencies.get(expense.currency) ?? { amount: 0, twd: 0 };
    currency.amount += expense.amount;
    currency.twd += twd;
    currencies.set(expense.currency, currency);
  }

  const tripLength = tripDays(trip.start_date, trip.end_date);

  const byCategory = [...categories.entries()]
    .map(([key, value]) => ({
      category: tripCategory(key),
      twd: value.twd,
      count: value.count,
      ratio: totalTwd > 0 ? value.twd / totalTwd : 0
    }))
    .sort((a, b) => b.twd - a.twd);

  const byDay = [...days.entries()]
    .map(([date, value]) => ({ date, twd: value.twd, count: value.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byCurrency = [...currencies.entries()]
    .map(([currency, value]) => ({ currency, amount: value.amount, twd: value.twd }))
    .sort((a, b) => b.twd - a.twd);

  const budget = trip.budget_twd ?? null;

  return {
    totalTwd,
    count: expenses.length,
    days: tripLength,
    perDayTwd: totalTwd > 0 ? Math.round(totalTwd / Math.max(tripLength, byDay.length)) : 0,
    byCategory,
    byDay,
    byCurrency,
    budgetUsed: budget ? totalTwd / budget : null,
    budgetLeftTwd: budget ? budget - totalTwd : null
  };
}

/** 記帳預設日期：旅行期間內就用今天，否則落在最接近的一端（出發前記預訂、回國後補帳）。 */
export function defaultExpenseDate(trip: Pick<Trip, 'start_date' | 'end_date'>, today: string): string {
  if (today < trip.start_date) return trip.start_date;
  if (today > trip.end_date) return trip.end_date;
  return today;
}

export type TripStatus = 'upcoming' | 'ongoing' | 'past';

export function tripStatus(trip: Pick<Trip, 'start_date' | 'end_date'>, today: string): TripStatus {
  if (today < trip.start_date) return 'upcoming';
  if (today > trip.end_date) return 'past';
  return 'ongoing';
}

/** 匯出旅行花費為 CSV 文字（含新台幣折算），供回國後對帳或貼進試算表。 */
export function tripExpensesToCsv(expenses: TripExpense[], memberName: (id: string | null | undefined) => string): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const header = ['日期', '分類', '金額', '幣別', '匯率', '折合新台幣', '付款方式', '付款人', '備註'];
  const rows = expenses.map((expense) =>
    [
      expense.expense_date,
      tripCategory(expense.category).label,
      String(expense.amount),
      expense.currency,
      String(expense.rate),
      String(toTwd(expense)),
      expense.payment_method === 'card' ? '刷卡' : expense.payment_method === 'cash' ? '現金' : '',
      memberName(expense.paid_by),
      expense.note ?? ''
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
