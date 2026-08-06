import type { Category, Currency, CurrencySummary, LedgerType, Transaction, TransactionType } from '../types';
import { emptyCurrencySummary } from './currency';

// 關鍵字搜尋／分類明細的純函式，全部無副作用以利測試。

export const SEARCH_RESULT_LIMIT = 300;

/** 名稱包含關鍵字的分類 id（大小寫不敏感；關鍵字空白回空陣列）。 */
export function matchCategoryIds(categories: Category[], keyword: string): string[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  return categories.filter((c) => c.name.toLowerCase().includes(kw)).map((c) => c.id);
}

function signedAmount(transaction: Transaction): number {
  const amount = Number(transaction.amount);
  return transaction.type === 'expense' ? -amount : amount;
}

/** 各幣別淨額：收入為正、支出為負。 */
export function sumByCurrency(transactions: Transaction[]): CurrencySummary {
  const totals = emptyCurrencySummary();
  for (const transaction of transactions) {
    totals[transaction.currency] += signedAmount(transaction);
  }
  return totals;
}

export interface MonthGroup {
  yearMonth: string; // '2026-08'
  label: string; // '2026年8月'
  items: Transaction[];
  totals: CurrencySummary;
}

/** 依月份分組（輸入假設已依日期新到舊，故同月份相鄰），每組附淨額小計。 */
export function groupByMonth(transactions: Transaction[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const transaction of transactions) {
    const yearMonth = transaction.transaction_date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.yearMonth !== yearMonth) {
      const [year, month] = yearMonth.split('-');
      group = { yearMonth, label: `${year}年${Number(month)}月`, items: [], totals: emptyCurrencySummary() };
      groups.push(group);
    }
    group.items.push(transaction);
    group.totals[transaction.currency] += signedAmount(transaction);
  }
  return groups;
}

export interface SearchFilters {
  type: TransactionType | 'all';
  currency: Currency | 'all';
  ownerId: string | 'all';
}

export function filterSearchResults(transactions: Transaction[], filters: SearchFilters): Transaction[] {
  return transactions.filter(
    (t) =>
      (filters.type === 'all' || t.type === filters.type) &&
      (filters.currency === 'all' || t.currency === filters.currency) &&
      (filters.ownerId === 'all' || t.owner_id === filters.ownerId)
  );
}

export type Period = 'all' | '3m' | '6m' | 'year';

/** 期間起始日（含）；'all' 回 null。todayISO 為 YYYY-MM-DD。 */
export function periodFrom(period: Period, todayISO: string): string | null {
  if (period === 'all') return null;
  const [year, month] = todayISO.split('-').map(Number);
  if (period === 'year') return `${year}-01-01`;
  const monthsBack = period === '3m' ? 2 : 5; // 「近3月」= 本月＋前 2 月
  const start = new Date(year, month - 1 - monthsBack, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
}

export function filterByPeriod(transactions: Transaction[], period: Period, todayISO: string): Transaction[] {
  const from = periodFrom(period, todayISO);
  if (!from) return transactions;
  return transactions.filter((t) => t.transaction_date >= from);
}

export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/** 把文字依關鍵字切段（大小寫不敏感）；關鍵字空白時整段不高亮。 */
export function splitHighlight(text: string, keyword: string): HighlightSegment[] {
  if (!text) return [];
  const kw = keyword.trim();
  if (!kw) return [{ text, hit: false }];

  const segments: HighlightSegment[] = [];
  const lower = text.toLowerCase();
  const kwLower = kw.toLowerCase();
  let index = 0;
  while (index < text.length) {
    const found = lower.indexOf(kwLower, index);
    if (found === -1) {
      segments.push({ text: text.slice(index), hit: false });
      break;
    }
    if (found > index) segments.push({ text: text.slice(index, found), hit: false });
    segments.push({ text: text.slice(found, found + kw.length), hit: true });
    index = found + kw.length;
  }
  return segments;
}

/** 跳脫 ilike 的萬用字元，讓「50%」搜得到字面值。 */
export function escapeLikePattern(keyword: string): string {
  return keyword.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** 合併多個查詢結果：同 id 去重、日期（再 created_at）新到舊、套用上限。 */
export function mergeSearchResults(transactions: Transaction[], limit = SEARCH_RESULT_LIMIT): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const transaction of transactions) {
    if (!byId.has(transaction.id)) byId.set(transaction.id, transaction);
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at)
    )
    .slice(0, limit);
}

export function addRecentSearch(list: string[], keyword: string, max = 8): string[] {
  const kw = keyword.trim();
  if (!kw) return list;
  return [kw, ...list.filter((item) => item !== kw)].slice(0, max);
}

export function recentSearchKey(ledgerType: LedgerType): string {
  return `fl:recent-searches:${ledgerType}`;
}

/** localStorage 讀寫包裝：壞資料回空陣列、寫入失敗不擲錯（便利功能不影響主流程）。 */
export function loadStringList(storage: Pick<Storage, 'getItem'>, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function saveStringList(storage: Pick<Storage, 'setItem'>, key: string, list: string[]): void {
  try {
    storage.setItem(key, JSON.stringify(list));
  } catch {
    // 容量滿等失敗忽略：搜尋紀錄／釘選是便利功能。
  }
}
