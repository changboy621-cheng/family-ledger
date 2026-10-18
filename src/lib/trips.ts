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
  /** 這筆裡幫朋友代墊的部分（之後朋友會還）。 */
  friend_shares?: FriendShare[];
}

export type RepaidMethod = 'cash' | 'transfer';

/** 代墊：一筆花費中替某位朋友付的金額（與花費同幣別、同匯率）。 */
export interface FriendShare {
  id: string;
  name: string;
  amount: number;
  /** 朋友還錢的日期；null = 還沒還。 */
  repaid_at: string | null;
  /** 還現金會加回手邊現金；轉帳則不影響。 */
  repaid_method: RepaidMethod | null;
}

/** 換匯紀錄：換到手的外幣現金。 */
export interface TripCashExchange {
  id: string;
  trip_id: string;
  family_id: string;
  recorded_by?: string | null;
  exchange_date: string;
  currency: string;
  /** 換到的原幣金額。 */
  amount: number;
  /** 換匯當下：1 單位 currency = rate 新台幣。 */
  rate: number;
  note?: string | null;
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

function roundTo(amount: number, currencyCode: string): number {
  const factor = 10 ** tripCurrency(currencyCode).decimals;
  return Math.round(amount * factor) / factor;
}

/** 這筆幫朋友代墊的原幣合計。 */
export function sharedAmount(expense: Pick<TripExpense, 'currency' | 'friend_shares'>): number {
  return roundTo((expense.friend_shares ?? []).reduce((sum, share) => sum + share.amount, 0), expense.currency);
}

/** 自己負擔的原幣金額 = 花費 − 代墊（不會小於 0）。 */
export function ownAmount(expense: Pick<TripExpense, 'amount' | 'currency' | 'friend_shares'>): number {
  return Math.max(0, roundTo(expense.amount - sharedAmount(expense), expense.currency));
}

/** 自己負擔的部分折合新台幣。 */
export function ownTwd(expense: Pick<TripExpense, 'amount' | 'currency' | 'rate' | 'friend_shares'>): number {
  return Math.round(ownAmount(expense) * expense.rate);
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

  // 只算自己負擔的部分；幫朋友代墊的錢之後會拿回來，不算這趟旅行的花費。
  for (const expense of expenses) {
    const own = ownAmount(expense);
    if (own <= 0) continue;
    const twd = ownTwd(expense);
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
    currency.amount += own;
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
    .map(([currency, value]) => ({ currency, amount: roundTo(value.amount, currency), twd: value.twd }))
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
  const header = ['日期', '分類', '金額', '幣別', '匯率', '折合新台幣', '自付金額', '代墊給朋友', '付款方式', '付款人', '備註'];
  const rows = expenses.map((expense) =>
    [
      expense.expense_date,
      tripCategory(expense.category).label,
      String(expense.amount),
      expense.currency,
      String(expense.rate),
      String(toTwd(expense)),
      String(ownAmount(expense)),
      (expense.friend_shares ?? [])
        .map((share) => `${share.name} ${share.amount}${share.repaid_at ? '（已還）' : ''}`)
        .join('、'),
      expense.payment_method === 'card' ? '刷卡' : expense.payment_method === 'cash' ? '現金' : '',
      memberName(expense.paid_by),
      expense.note ?? ''
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export interface TripCashBalance {
  currency: string;
  /** 換到手的原幣合計。 */
  exchanged: number;
  /** 朋友用現金還的代墊款（原幣合計）。 */
  received: number;
  /** 用現金付掉的原幣合計。 */
  spent: number;
  /** 手邊剩下的原幣（可能為負：現金花費多於換匯紀錄，代表漏記換匯或記錯付款方式）。 */
  remaining: number;
  /** 換匯花掉的新台幣（換匯成本）。 */
  costTwd: number;
}

/**
 * 每個「有換匯紀錄」的幣別手邊還剩多少現金：換匯合計 ＋ 朋友還的現金 − 該幣別付款方式為現金的花費。
 * 沒換過匯的幣別（例如刷卡、或直接帶台幣）不列入，避免出現莫名的負數。
 * 依原幣小數位取整，消除浮點誤差。
 */
export function cashOnHand(exchanges: TripCashExchange[], expenses: TripExpense[]): TripCashBalance[] {
  const balances = new Map<string, { exchanged: number; received: number; spent: number; costTwd: number }>();
  for (const exchange of exchanges) {
    const balance = balances.get(exchange.currency) ?? { exchanged: 0, received: 0, spent: 0, costTwd: 0 };
    balance.exchanged += exchange.amount;
    balance.costTwd += toTwd(exchange);
    balances.set(exchange.currency, balance);
  }
  for (const expense of expenses) {
    const balance = balances.get(expense.currency);
    if (!balance) continue;
    if (expense.payment_method === 'cash') balance.spent += expense.amount;
    for (const share of expense.friend_shares ?? []) {
      if (share.repaid_at && share.repaid_method === 'cash') balance.received += share.amount;
    }
  }

  return [...balances.entries()]
    .map(([currency, value]) => {
      const exchanged = roundTo(value.exchanged, currency);
      const received = roundTo(value.received, currency);
      const spent = roundTo(value.spent, currency);
      return {
        currency,
        exchanged,
        received,
        spent,
        remaining: roundTo(exchanged + received - spent, currency),
        costTwd: value.costTwd
      };
    })
    .sort((a, b) => b.costTwd - a.costTwd);
}

export interface FriendShareItem {
  expense: TripExpense;
  share: FriendShare;
  twd: number;
}

export interface FriendDebt {
  name: string;
  /** 還沒還的代墊（新到舊）。 */
  outstanding: FriendShareItem[];
  outstandingTwd: number;
  /** 還沒還的原幣金額，依幣別分開（不同幣別不能直接相加）。 */
  outstandingByCurrency: Array<{ currency: string; amount: number }>;
  repaid: FriendShareItem[];
  repaidTwd: number;
}

/** 依朋友彙總代墊：誰還欠多少（未還多的排前面），以及已經還了多少。名字前後空白不影響歸戶。 */
export function friendDebts(expenses: TripExpense[]): FriendDebt[] {
  const byName = new Map<string, FriendDebt & { currencies: Map<string, number> }>();
  for (const expense of expenses) {
    for (const share of expense.friend_shares ?? []) {
      const name = share.name.trim();
      if (!name) continue;
      const debt = byName.get(name) ?? {
        name,
        outstanding: [] as FriendShareItem[],
        outstandingTwd: 0,
        outstandingByCurrency: [],
        repaid: [] as FriendShareItem[],
        repaidTwd: 0,
        currencies: new Map<string, number>()
      };
      const item: FriendShareItem = { expense, share, twd: Math.round(share.amount * expense.rate) };
      if (share.repaid_at) {
        debt.repaid.push(item);
        debt.repaidTwd += item.twd;
      } else {
        debt.outstanding.push(item);
        debt.outstandingTwd += item.twd;
        debt.currencies.set(expense.currency, (debt.currencies.get(expense.currency) ?? 0) + share.amount);
      }
      byName.set(name, debt);
    }
  }

  return [...byName.values()]
    .map(({ currencies, ...debt }) => ({
      ...debt,
      outstandingByCurrency: [...currencies.entries()].map(([currency, amount]) => ({
        currency,
        amount: roundTo(amount, currency)
      }))
    }))
    .sort((a, b) => b.outstandingTwd - a.outstandingTwd || a.name.localeCompare(b.name));
}

/** 這趟用過的朋友名字（最近先），供記帳時快速選。 */
export function knownFriendNames(expenses: TripExpense[]): string[] {
  const names: string[] = [];
  for (const expense of expenses) {
    for (const share of expense.friend_shares ?? []) {
      const name = share.name.trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

/** 把某筆代墊標成已還（或改回未還），回傳新的 friend_shares 陣列。 */
export function setShareRepaid(
  shares: FriendShare[],
  shareId: string,
  repaid: { date: string; method: RepaidMethod } | null
): FriendShare[] {
  return shares.map((share) =>
    share.id === shareId
      ? { ...share, repaid_at: repaid?.date ?? null, repaid_method: repaid?.method ?? null }
      : share
  );
}
