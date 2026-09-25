import type { RecurringTransaction } from '../types';

// 固定收支的純函式：算出哪些月份到期、該記在哪一天、產生的交易長什麼樣子。

/** 久未開 App 時最多補記幾個月，避免一次灌入大量交易。 */
export const MAX_CATCH_UP_MONTHS = 12;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function addMonthsToYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return toYearMonth(date);
}

/** 該月實際記入的日期（YYYY-MM-DD）；月份天數不足時用最後一天，例如 2 月的 31 號 → 2/28。 */
export function occurrenceDate(yearMonth: string, dayOfMonth: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${pad(Math.min(dayOfMonth, lastDay))}`;
}

function todayString(today: Date) {
  return `${toYearMonth(today)}-${pad(today.getDate())}`;
}

/**
 * 需要補記的月份（由舊到新）：從 start_month 或上次處理月份的下一個月起，
 * 到今天為止「記入日已到」的月份。暫停中的規則不產生。
 */
export function dueMonths(
  rule: Pick<RecurringTransaction, 'active' | 'start_month' | 'last_generated_month' | 'day_of_month'>,
  today: Date = new Date()
): string[] {
  if (!rule.active) return [];

  const afterLast = rule.last_generated_month ? addMonthsToYearMonth(rule.last_generated_month, 1) : rule.start_month;
  let month = afterLast > rule.start_month ? afterLast : rule.start_month;
  const todayText = todayString(today);
  const months: string[] = [];

  while (occurrenceDate(month, rule.day_of_month) <= todayText) {
    months.push(month);
    month = addMonthsToYearMonth(month, 1);
  }

  return months.slice(-MAX_CATCH_UP_MONTHS);
}

/** 下一次記入日（YYYY-MM-DD）；暫停中為 null。 */
export function nextOccurrence(
  rule: Pick<RecurringTransaction, 'active' | 'start_month' | 'last_generated_month' | 'day_of_month'>,
  today: Date = new Date()
): string | null {
  if (!rule.active) return null;
  const due = dueMonths(rule, today);
  const processed = due.length > 0 ? due[due.length - 1] : rule.last_generated_month;
  const afterProcessed = processed ? addMonthsToYearMonth(processed, 1) : rule.start_month;
  const month = afterProcessed > rule.start_month ? afterProcessed : rule.start_month;
  return occurrenceDate(month, rule.day_of_month);
}

/**
 * 新增規則時的預設起始月份：本月記入日還沒過就從本月開始；已過則從下個月開始，
 * 避免把這個月可能已經手動記過的帳再記一次（表單可勾選「本月也記入」覆寫）。
 */
export function defaultStartMonth(dayOfMonth: number, today: Date = new Date()): string {
  const thisMonth = toYearMonth(today);
  return occurrenceDate(thisMonth, dayOfMonth) >= todayString(today) ? thisMonth : addMonthsToYearMonth(thisMonth, 1);
}

/** 由規則產生某月的一筆交易（寫入 transactions 的欄位）。 */
export function buildRecurringTransaction(rule: RecurringTransaction, yearMonth: string, recorderId: string) {
  return {
    family_id: rule.family_id,
    owner_id: rule.owner_id,
    recorded_by: recorderId,
    ledger_type: rule.ledger_type,
    type: rule.type,
    amount: rule.amount,
    currency: rule.currency,
    category_id: rule.category_id,
    note: rule.note?.trim() || null,
    payment_method: rule.payment_method ?? null,
    transaction_date: occurrenceDate(yearMonth, rule.day_of_month),
    recurring_id: rule.id,
    recurring_month: yearMonth
  };
}

/** 「每月 5 號」；29 號以後補一句短月份的處理方式。 */
export function describeSchedule(dayOfMonth: number): string {
  return dayOfMonth >= 29 ? `每月 ${dayOfMonth} 號（短月份記在月底）` : `每月 ${dayOfMonth} 號`;
}

/**
 * 恢復暫停中的規則時，要把「已處理月份」推進到哪裡：推到上個月，暫停期間的月份不補記；
 * 本月記入日若已到，恢復後就會記入本月。回傳 null 表示不用調整。
 */
export function resumedLastGeneratedMonth(
  rule: Pick<RecurringTransaction, 'start_month' | 'last_generated_month'>,
  today: Date = new Date()
): string | null {
  const previousMonth = addMonthsToYearMonth(toYearMonth(today), -1);
  if (rule.start_month > previousMonth) return null;
  if (rule.last_generated_month && rule.last_generated_month >= previousMonth) return null;
  return previousMonth;
}

/** 2026-10-05 → 10/5 */
export function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}`;
}
