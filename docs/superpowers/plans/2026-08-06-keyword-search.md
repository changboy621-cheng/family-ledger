# 關鍵字搜尋＋分類明細＋備註歷史加強 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 帳本頁可跨全部月份搜尋備註（含比對分類名稱）、支出分類可點入看跨月明細（期間／成員篩選）、記帳表單備註歷史加量＋聰明帶入＋釘選。

**Architecture:** 純函式集中在 `src/lib/search.ts` 與 `src/lib/suggestions.ts`（TDD 主戰場）；新 hook `useTransactionSearch` 沿用 `useTransactions` 的過濾與請求序號模式；新元件 `TransactionSearchModal` 同時涵蓋「關鍵字搜尋」與「分類明細」兩種模式，編輯/刪除直接重用 LedgerPage 傳入的 `updateTransaction`/`deleteTransaction`。視覺為漸層玻璃風（僅新畫面）。

**Tech Stack:** React 18 + TypeScript + Tailwind + Supabase JS + Zustand + vitest/@testing-library/react（jsdom）。

**Spec:** `docs/superpowers/specs/2026-08-06-keyword-search-design.md`

## Global Constraints

- 文案一律繁體中文，與現有 App 用語一致。
- 輸入框字級 ≥16px（Tailwind `text-base`）—— iOS 防自動放大（見 commit adbb138）。
- 錯誤不得靜默吞掉：`console.error` ＋ UI 顯示錯誤與重試（比照 `useTransactions`）。
- 搜尋上限 300 筆：`SEARCH_RESULT_LIMIT = 300`，超限時 UI 顯示「僅顯示最近 300 筆，可加關鍵字縮小範圍」。
- localStorage key 格式：`fl:recent-searches:<ledgerType>`、`fl:pinned-notes:<ledgerType>:<type>`。
- 漸層玻璃風只用於 `TransactionSearchModal`；其他頁面樣式不動。
- 測試指令：`npx vitest run <檔案路徑>`；全量 `npm test`。
- 不需要資料庫 migration。

---

### Task 1: `src/lib/search.ts` 純函式庫

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`

**Interfaces:**
- Consumes: `src/types`（`Category`, `Currency`, `CurrencySummary`, `LedgerType`, `Transaction`, `TransactionType`）、`emptyCurrencySummary`（`src/lib/currency.ts`）
- Produces（後續 Task 依賴的確切簽名）:
  - `SEARCH_RESULT_LIMIT: number`（= 300）
  - `matchCategoryIds(categories: Category[], keyword: string): string[]`
  - `sumByCurrency(transactions: Transaction[]): CurrencySummary`
  - `groupByMonth(transactions: Transaction[]): MonthGroup[]`，`MonthGroup = { yearMonth: string; label: string; items: Transaction[]; totals: CurrencySummary }`
  - `filterSearchResults(transactions: Transaction[], filters: SearchFilters): Transaction[]`，`SearchFilters = { type: TransactionType | 'all'; currency: Currency | 'all'; ownerId: string | 'all' }`
  - `type Period = 'all' | '3m' | '6m' | 'year'`；`periodFrom(period: Period, todayISO: string): string | null`；`filterByPeriod(transactions: Transaction[], period: Period, todayISO: string): Transaction[]`
  - `splitHighlight(text: string, keyword: string): HighlightSegment[]`，`HighlightSegment = { text: string; hit: boolean }`
  - `escapeLikePattern(keyword: string): string`
  - `mergeSearchResults(transactions: Transaction[], limit?: number): Transaction[]`
  - `addRecentSearch(list: string[], keyword: string, max?: number): string[]`；`recentSearchKey(ledgerType: LedgerType): string`
  - `loadStringList(storage: Pick<Storage, 'getItem'>, key: string): string[]`；`saveStringList(storage: Pick<Storage, 'setItem'>, key: string, list: string[]): void`

- [ ] **Step 1: 寫失敗測試**

`src/lib/search.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../types';
import {
  addRecentSearch,
  escapeLikePattern,
  filterByPeriod,
  filterSearchResults,
  groupByMonth,
  loadStringList,
  matchCategoryIds,
  mergeSearchResults,
  periodFrom,
  recentSearchKey,
  saveStringList,
  splitHighlight,
  sumByCurrency
} from './search';

const category = (id: string, name: string): Category =>
  ({ id, name, icon: '🏷️', type: 'expense', is_shared: true } as Category);

const tx = (overrides: Partial<Transaction>): Transaction =>
  ({
    id: 'id',
    type: 'expense',
    amount: 100,
    currency: 'TWD',
    owner_id: 'u1',
    transaction_date: '2026-08-01',
    created_at: '2026-08-01T00:00:00Z',
    ...overrides
  } as Transaction);

describe('matchCategoryIds', () => {
  const categories = [category('c1', '餐飲'), category('c2', '交通'), category('c3', '聚餐')];

  it('回傳名稱包含關鍵字的分類 id', () => {
    expect(matchCategoryIds(categories, '餐')).toEqual(['c1', 'c3']);
  });

  it('大小寫不敏感', () => {
    expect(matchCategoryIds([category('c9', 'Netflix')], 'netflix')).toEqual(['c9']);
  });

  it('關鍵字空白或無符合時回空陣列', () => {
    expect(matchCategoryIds(categories, '  ')).toEqual([]);
    expect(matchCategoryIds(categories, '水電')).toEqual([]);
  });
});

describe('sumByCurrency', () => {
  it('支出為負、收入為正，按幣別彙總', () => {
    const totals = sumByCurrency([
      tx({ amount: 100, type: 'expense', currency: 'TWD' }),
      tx({ amount: 300, type: 'income', currency: 'TWD' }),
      tx({ amount: 5, type: 'expense', currency: 'USD' })
    ]);
    expect(totals).toEqual({ TWD: 200, USD: -5 });
  });
});

describe('groupByMonth', () => {
  it('依月份分組（輸入新到舊）、附中文標籤與各組淨額', () => {
    const groups = groupByMonth([
      tx({ id: 'a', transaction_date: '2026-08-05', amount: 100 }),
      tx({ id: 'b', transaction_date: '2026-08-01', amount: 50 }),
      tx({ id: 'c', transaction_date: '2026-07-20', amount: 30, type: 'income' })
    ]);
    expect(groups.map((g) => g.yearMonth)).toEqual(['2026-08', '2026-07']);
    expect(groups[0].label).toBe('2026年8月');
    expect(groups[0].items.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[0].totals.TWD).toBe(-150);
    expect(groups[1].totals.TWD).toBe(30);
  });

  it('空輸入回空陣列', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('filterSearchResults', () => {
  const rows = [
    tx({ id: 'a', type: 'expense', currency: 'TWD', owner_id: 'u1' }),
    tx({ id: 'b', type: 'income', currency: 'TWD', owner_id: 'u2' }),
    tx({ id: 'c', type: 'expense', currency: 'USD', owner_id: 'u1' })
  ];
  it("全部 'all' 時不過濾", () => {
    expect(filterSearchResults(rows, { type: 'all', currency: 'all', ownerId: 'all' })).toHaveLength(3);
  });
  it('依型別、幣別、成員交叉過濾', () => {
    expect(
      filterSearchResults(rows, { type: 'expense', currency: 'TWD', ownerId: 'u1' }).map((t) => t.id)
    ).toEqual(['a']);
  });
});

describe('periodFrom / filterByPeriod', () => {
  it("'all' 回 null、不過濾", () => {
    expect(periodFrom('all', '2026-08-06')).toBeNull();
    expect(filterByPeriod([tx({ transaction_date: '2020-01-01' })], 'all', '2026-08-06')).toHaveLength(1);
  });
  it("'3m' 含本月共 3 個月、'6m' 共 6 個月（跨年正確）", () => {
    expect(periodFrom('3m', '2026-08-06')).toBe('2026-06-01');
    expect(periodFrom('6m', '2026-02-15')).toBe('2025-09-01');
  });
  it("'year' 為今年 1/1 起", () => {
    expect(periodFrom('year', '2026-08-06')).toBe('2026-01-01');
  });
  it('filterByPeriod 依起始日（含）過濾', () => {
    const rows = [tx({ id: 'a', transaction_date: '2026-06-01' }), tx({ id: 'b', transaction_date: '2026-05-31' })];
    expect(filterByPeriod(rows, '3m', '2026-08-06').map((t) => t.id)).toEqual(['a']);
  });
});

describe('splitHighlight', () => {
  it('關鍵字段標記 hit=true，其餘 false；多次出現都標', () => {
    expect(splitHighlight('機票 東京 機票', '機票')).toEqual([
      { text: '機票', hit: true },
      { text: ' 東京 ', hit: false },
      { text: '機票', hit: true }
    ]);
  });
  it('關鍵字在頭/尾、大小寫不敏感', () => {
    expect(splitHighlight('Netflix 月費', 'netflix')).toEqual([
      { text: 'Netflix', hit: true },
      { text: ' 月費', hit: false }
    ]);
  });
  it('無符合時整段不高亮；關鍵字空白不高亮；空字串回空陣列', () => {
    expect(splitHighlight('午餐', '晚')).toEqual([{ text: '午餐', hit: false }]);
    expect(splitHighlight('午餐', ' ')).toEqual([{ text: '午餐', hit: false }]);
    expect(splitHighlight('', '午')).toEqual([]);
  });
});

describe('escapeLikePattern', () => {
  it('跳脫 % _ 與反斜線', () => {
    expect(escapeLikePattern('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('mergeSearchResults', () => {
  it('去重（同 id 取一）、日期新到舊排序、套用上限', () => {
    const merged = mergeSearchResults(
      [
        tx({ id: 'a', transaction_date: '2026-07-01' }),
        tx({ id: 'b', transaction_date: '2026-08-01' }),
        tx({ id: 'a', transaction_date: '2026-07-01' }),
        tx({ id: 'c', transaction_date: '2026-06-01' })
      ],
      2
    );
    expect(merged.map((t) => t.id)).toEqual(['b', 'a']);
  });
  it('同日期以 created_at 新到舊', () => {
    const merged = mergeSearchResults([
      tx({ id: 'old', transaction_date: '2026-08-01', created_at: '2026-08-01T01:00:00Z' }),
      tx({ id: 'new', transaction_date: '2026-08-01', created_at: '2026-08-01T02:00:00Z' })
    ]);
    expect(merged.map((t) => t.id)).toEqual(['new', 'old']);
  });
});

describe('addRecentSearch / storage helpers', () => {
  it('最新在前、去重、上限 8、空白不加入', () => {
    expect(addRecentSearch(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(addRecentSearch([], '  ')).toEqual([]);
    expect(addRecentSearch(['1', '2', '3', '4', '5', '6', '7', '8'], '9')).toHaveLength(8);
  });

  it('recentSearchKey 依帳本型別命名', () => {
    expect(recentSearchKey('family')).toBe('fl:recent-searches:family');
  });

  it('loadStringList 壞資料回空陣列、非字串元素被濾除', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v)
    };
    expect(loadStringList(storage, 'k')).toEqual([]);
    store.set('k', 'not-json{');
    expect(loadStringList(storage, 'k')).toEqual([]);
    store.set('k', JSON.stringify(['a', 1, 'b']));
    expect(loadStringList(storage, 'k')).toEqual(['a', 'b']);
    saveStringList(storage, 'k2', ['x']);
    expect(loadStringList(storage, 'k2')).toEqual(['x']);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/search.test.ts`
Expected: FAIL —— `Cannot find module './search'`（或同義錯誤）。

- [ ] **Step 3: 實作 `src/lib/search.ts`**

```ts
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/search.test.ts`
Expected: PASS（全部綠）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat(search): 搜尋純函式庫（分組、篩選、高亮、合併、最近搜尋）"
```

---

### Task 2: `src/lib/suggestions.ts` 加量＋聰明帶入＋釘選純函式

**Files:**
- Modify: `src/lib/suggestions.ts`
- Test: `src/lib/suggestions.test.ts`（擴充既有檔案，保留原測試並更新上限相關斷言）

**Interfaces:**
- Consumes: `src/types`（`Currency`, `LedgerType`, `PaymentMethod`, `TransactionType`）
- Produces:
  - `EntryRow` 增加選填欄位：`category_id?: string | null; amount?: number | null; currency?: Currency | null; payment_method?: PaymentMethod | null`
  - `computeRecentNotes(rows: EntryRow[], limit = 30): string[]`（原 10 → 30）
  - `filterNotes(notes: string[], query: string, limit = 8): string[]`（原 6 → 8）
  - `NoteDefaults = { category_id: string | null; amount: number | null; currency: Currency | null; payment_method: PaymentMethod | null }`
  - `buildNoteDefaults(rows: EntryRow[]): Map<string, NoteDefaults>`
  - `togglePin(pinned: string[], note: string): string[]`
  - `mergeNoteSuggestions(pinned: string[], history: string[], query: string, limit = 8): string[]`
  - `pinnedNotesKey(ledgerType: LedgerType, type: TransactionType): string`

- [ ] **Step 1: 寫失敗測試**

在 `src/lib/suggestions.test.ts` 追加（並把原本斷言 10/6 上限的測試改成 30/8）：

```ts
import {
  buildNoteDefaults,
  computeRecentNotes,
  filterNotes,
  mergeNoteSuggestions,
  pinnedNotesKey,
  togglePin,
  type EntryRow
} from './suggestions';

describe('computeRecentNotes 上限 30', () => {
  it('超過 30 個不重複備註時只取前 30', () => {
    const rows: EntryRow[] = Array.from({ length: 40 }, (_, i) => ({ note: `備註${i}` }));
    expect(computeRecentNotes(rows)).toHaveLength(30);
  });
});

describe('filterNotes 顯示上限 8', () => {
  it('無輸入時最多回 8 個', () => {
    const notes = Array.from({ length: 12 }, (_, i) => `n${i}`);
    expect(filterNotes(notes, '')).toHaveLength(8);
  });
});

describe('buildNoteDefaults', () => {
  it('同備註取最新一筆（rows 新到舊，取第一次出現）', () => {
    const rows: EntryRow[] = [
      { note: '星巴克', category_id: 'c-food', amount: 150, currency: 'TWD', payment_method: 'card' },
      { note: '星巴克', category_id: 'c-old', amount: 120, currency: 'TWD', payment_method: 'cash' },
      { note: '加油', category_id: 'c-car', amount: 800, currency: 'TWD', payment_method: 'cash' }
    ];
    const defaults = buildNoteDefaults(rows);
    expect(defaults.get('星巴克')).toEqual({
      category_id: 'c-food',
      amount: 150,
      currency: 'TWD',
      payment_method: 'card'
    });
    expect(defaults.get('加油')?.category_id).toBe('c-car');
  });

  it('空備註或缺欄位不進 Map／缺欄位補 null', () => {
    const defaults = buildNoteDefaults([{ note: '  ' }, { note: '只有備註' }]);
    expect(defaults.has('  ')).toBe(false);
    expect(defaults.get('只有備註')).toEqual({ category_id: null, amount: null, currency: null, payment_method: null });
  });
});

describe('togglePin', () => {
  it('未釘選→加入最前；已釘選→移除', () => {
    expect(togglePin(['a'], 'b')).toEqual(['b', 'a']);
    expect(togglePin(['b', 'a'], 'b')).toEqual(['a']);
  });
});

describe('mergeNoteSuggestions', () => {
  it('釘選在前、歷史去重、上限 8', () => {
    const merged = mergeNoteSuggestions(['房租'], ['星巴克', '房租', '加油'], '');
    expect(merged).toEqual(['房租', '星巴克', '加油']);
    const many = mergeNoteSuggestions(['p1', 'p2'], Array.from({ length: 10 }, (_, i) => `h${i}`), '');
    expect(many).toHaveLength(8);
    expect(many.slice(0, 2)).toEqual(['p1', 'p2']);
  });

  it('打字時釘選與歷史都依輸入過濾，釘選仍在前；與輸入完全相同者排除', () => {
    expect(mergeNoteSuggestions(['星巴克'], ['星巴克 拿鐵', '加油'], '星')).toEqual(['星巴克', '星巴克 拿鐵']);
    expect(mergeNoteSuggestions(['星巴克'], [], '星巴克')).toEqual([]);
  });
});

describe('pinnedNotesKey', () => {
  it('依帳本型別與收支型別命名', () => {
    expect(pinnedNotesKey('family', 'expense')).toBe('fl:pinned-notes:family:expense');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/suggestions.test.ts`
Expected: FAIL —— `buildNoteDefaults` 等未匯出；上限測試失敗。

- [ ] **Step 3: 實作**

`src/lib/suggestions.ts` 全文改為：

```ts
import type { Currency, LedgerType, PaymentMethod, TransactionType } from '../types';

// 從最近交易推算「備註歷史」，全部為純函式以利測試。

export interface EntryRow {
  note: string | null;
  transaction_date?: string;
  category_id?: string | null;
  amount?: number | null;
  currency?: Currency | null;
  payment_method?: PaymentMethod | null;
}

/** 取不重複的備註，最近使用的在前（rows 假設已依日期由新到舊）。 */
export function computeRecentNotes(rows: EntryRow[], limit = 30): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];

  for (const row of rows) {
    const note = row.note?.trim();
    if (!note || seen.has(note)) continue;
    seen.add(note);
    notes.push(note);
    if (notes.length >= limit) break;
  }

  return notes;
}

/** 依目前輸入過濾備註提示；排除與輸入完全相同者。 */
export function filterNotes(notes: string[], query: string, limit = 8): string[] {
  const trimmed = query.trim();
  const matched = trimmed
    ? notes.filter((note) => note.includes(trimmed) && note !== trimmed)
    : notes;
  return matched.slice(0, limit);
}

export interface NoteDefaults {
  category_id: string | null;
  amount: number | null;
  currency: Currency | null;
  payment_method: PaymentMethod | null;
}

/** 備註 → 最近一次使用的分類/金額/幣別/付款方式（rows 新到舊，第一次出現即最新）。 */
export function buildNoteDefaults(rows: EntryRow[]): Map<string, NoteDefaults> {
  const defaults = new Map<string, NoteDefaults>();
  for (const row of rows) {
    const note = row.note?.trim();
    if (!note || defaults.has(note)) continue;
    defaults.set(note, {
      category_id: row.category_id ?? null,
      amount: row.amount ?? null,
      currency: row.currency ?? null,
      payment_method: row.payment_method ?? null
    });
  }
  return defaults;
}

/** 釘選切換：未釘選加到最前、已釘選移除。 */
export function togglePin(pinned: string[], note: string): string[] {
  return pinned.includes(note) ? pinned.filter((item) => item !== note) : [note, ...pinned];
}

/** 釘選優先的建議清單：兩邊都依輸入過濾（沿用 filterNotes 規則），釘選在前、去重、套用上限。 */
export function mergeNoteSuggestions(pinned: string[], history: string[], query: string, limit = 8): string[] {
  const pinnedMatched = filterNotes(pinned, query, limit);
  const historyMatched = filterNotes(
    history.filter((note) => !pinned.includes(note)),
    query,
    limit
  );
  return [...pinnedMatched, ...historyMatched].slice(0, limit);
}

export function pinnedNotesKey(ledgerType: LedgerType, type: TransactionType): string {
  return `fl:pinned-notes:${ledgerType}:${type}`;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/suggestions.test.ts`
Expected: PASS。若原檔有斷言「最多 10 筆／6 個」的舊測試而失敗，把該斷言改為 30／8（行為變更是本次規格）。

- [ ] **Step 5: 全量測試防回歸（filterNotes 上限變更影響面）**

Run: `npm test`
Expected: PASS（`useEntrySuggestions.test`、`TransactionForm` 相關若有壞，依新上限修正斷言）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/suggestions.ts src/lib/suggestions.test.ts
git commit -m "feat(suggestions): 備註歷史加量、聰明帶入對照、釘選純函式"
```

---

### Task 3: `entryRowSchema` 擴充＋`useEntrySuggestions` 回傳聰明帶入資料

**Files:**
- Modify: `src/lib/schemas.ts:56-59`（`entryRowSchema`）
- Modify: `src/hooks/useEntrySuggestions.ts`
- Test: `src/hooks/useCategories.test.ts` 同層新增於 `src/lib/schemas.test.ts` 與既有 `src/hooks/useEntrySuggestions` 相關測試（若無 hook 測試檔則只補 schema 測試）

**Interfaces:**
- Consumes: Task 2 的 `computeRecentNotes`, `buildNoteDefaults`
- Produces: `useEntrySuggestions(ledgerType, type)` 回傳 `{ noteHistory: string[]; noteDefaults: Map<string, NoteDefaults> }`

- [ ] **Step 1: 寫失敗測試**

`src/lib/schemas.test.ts` 追加：

```ts
import { parseEntryRows } from './schemas';

describe('entryRowSchema 聰明帶入欄位', () => {
  it('解析 category_id/amount/currency/payment_method；壞值退回 null 不丟列', () => {
    const rows = parseEntryRows([
      { note: '星巴克', category_id: 'c1', amount: 150, currency: 'TWD', payment_method: 'card' },
      { note: '壞資料', category_id: 'c2', amount: 'NaN', currency: 'JPY', payment_method: 'check' }
    ]);
    expect(rows[0]).toMatchObject({ note: '星巴克', category_id: 'c1', amount: 150, currency: 'TWD', payment_method: 'card' });
    expect(rows[1]).toMatchObject({ note: '壞資料', amount: null, currency: null, payment_method: null });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/schemas.test.ts`
Expected: FAIL —— 新欄位被 strip（undefined），斷言不符。

- [ ] **Step 3: 實作**

`src/lib/schemas.ts` 的 `entryRowSchema` 改為：

```ts
export const entryRowSchema = z.object({
  note: z.string().nullish().catch(null),
  transaction_date: z.string().optional(),
  // 聰明帶入用欄位：壞值退回 null，不整列丟棄。
  category_id: z.string().nullish().catch(null),
  amount: z.number().nullish().catch(null),
  currency: currencySchema.nullish().catch(null),
  payment_method: paymentMethodSchema.nullish().catch(null)
});
```

`src/hooks/useEntrySuggestions.ts`：

1. 查詢欄位改為：

```ts
      let query = supabase
        .from('transactions')
        .select('note, transaction_date, category_id, amount, currency, payment_method')
```

2. 回傳值改為：

```ts
  // rows 變動才重算；否則表單每次輸入（rerender）都會重掃最多 200 列。
  const noteHistory = useMemo(() => computeRecentNotes(rows), [rows]);
  const noteDefaults = useMemo(() => buildNoteDefaults(rows), [rows]);

  return { noteHistory, noteDefaults };
```

並在頂部 import 補上 `buildNoteDefaults`：

```ts
import { buildNoteDefaults, computeRecentNotes } from '../lib/suggestions';
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/schemas.test.ts && npm test`
Expected: 全部 PASS（`useEntrySuggestions` 既有消費端只解構 `noteHistory`，新增欄位不破壞）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/hooks/useEntrySuggestions.ts
git commit -m "feat(suggestions): useEntrySuggestions 回傳聰明帶入所需欄位"
```

---

### Task 4: `useTransactionSearch` hook

**Files:**
- Modify: `src/hooks/useTransactions.ts:27`（`const TRANSACTION_SELECT` → `export const TRANSACTION_SELECT`）
- Create: `src/hooks/useTransactionSearch.ts`
- Test: `src/hooks/useTransactionSearch.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `escapeLikePattern`, `mergeSearchResults`, `SEARCH_RESULT_LIMIT`；`TRANSACTION_SELECT`；`parseTransactions`；`useAuthStore`
- Produces:
  - `type SearchMode = { kind: 'keyword'; keyword: string; categoryIds: string[] } | { kind: 'category'; categoryId: string }`
  - `buildSearchQueries(ledgerType: LedgerType, profile: { id: string; family_id: string }, mode: SearchMode)` → Supabase query 陣列（供測試）
  - `useTransactionSearch(ledgerType: LedgerType, mode: SearchMode | null)` → `{ results: Transaction[]; loading: boolean; error: boolean; refetch: () => Promise<void> }`
  - **呼叫端契約：`mode` 物件必須 `useMemo` 化**（identity 進 `useCallback` deps，否則每次 render 重查）。

- [ ] **Step 1: 寫失敗測試**

`src/hooks/useTransactionSearch.test.ts`（builder-mock 風格比照 `useTransactions.test.ts`）：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { buildSearchQueries } from './useTransactionSearch';

// 紀錄 query builder 上每個過濾呼叫，最後以 thenable 回傳 {data,error}
function makeBuilder(calls: Array<[string, ...unknown[]]>) {
  const builder: Record<string, unknown> = {};
  const record = (m: string) => (...args: unknown[]) => {
    calls.push([m, ...args]);
    return builder;
  };
  builder.select = vi.fn(record('select'));
  builder.eq = vi.fn(record('eq'));
  builder.ilike = vi.fn(record('ilike'));
  builder.in = vi.fn(record('in'));
  builder.order = vi.fn(record('order'));
  builder.limit = vi.fn(record('limit'));
  builder.then = (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return builder;
}

const profile = { id: 'u1', family_id: 'fam1' };

describe('buildSearchQueries', () => {
  let calls: Array<[string, ...unknown[]]>;
  beforeEach(() => {
    calls = [];
    from.mockReset();
    from.mockReturnValue(makeBuilder(calls));
  });

  it('keyword 模式：note ilike（含跳脫）、無日期範圍、上限 300', () => {
    const queries = buildSearchQueries('family', profile, {
      kind: 'keyword',
      keyword: '50%',
      categoryIds: []
    });
    expect(queries).toHaveLength(1);
    expect(calls).toContainEqual(['eq', 'ledger_type', 'family']);
    expect(calls).toContainEqual(['eq', 'family_id', 'fam1']);
    expect(calls).toContainEqual(['ilike', 'note', '%50\\%%']);
    expect(calls).toContainEqual(['limit', 300]);
    expect(calls.some(([m]) => m === 'gte' || m === 'lte')).toBe(false);
  });

  it('keyword 模式有符合分類時，另發 category_id in 查詢', () => {
    const queries = buildSearchQueries('family', profile, {
      kind: 'keyword',
      keyword: '餐',
      categoryIds: ['c1', 'c3']
    });
    expect(queries).toHaveLength(2);
    expect(calls).toContainEqual(['in', 'category_id', ['c1', 'c3']]);
  });

  it('category 模式：以 category_id 過濾、personal 以 owner_id 過濾', () => {
    buildSearchQueries('personal', profile, { kind: 'category', categoryId: 'c9' });
    expect(calls).toContainEqual(['eq', 'category_id', 'c9']);
    expect(calls).toContainEqual(['eq', 'owner_id', 'u1']);
    expect(calls).not.toContainEqual(['eq', 'family_id', 'fam1']);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/hooks/useTransactionSearch.test.ts`
Expected: FAIL —— 模組不存在。

- [ ] **Step 3: 實作**

先把 `src/hooks/useTransactions.ts:27` 改為：

```ts
export const TRANSACTION_SELECT = '*, category:categories(*), owner:user_profiles(*)';
```

`src/hooks/useTransactionSearch.ts`：

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LedgerType, Transaction } from '../types';
import { supabase } from '../lib/supabase';
import { parseTransactions } from '../lib/schemas';
import { escapeLikePattern, mergeSearchResults, SEARCH_RESULT_LIMIT } from '../lib/search';
import { TRANSACTION_SELECT } from './useTransactions';
import { useAuthStore } from '../store/authStore';

export type SearchMode =
  | { kind: 'keyword'; keyword: string; categoryIds: string[] }
  | { kind: 'category'; categoryId: string };

interface SearchProfile {
  id: string;
  family_id: string;
}

function baseQuery(ledgerType: LedgerType, profile: SearchProfile) {
  const query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('ledger_type', ledgerType)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(SEARCH_RESULT_LIMIT);
  return ledgerType === 'family' ? query.eq('family_id', profile.family_id) : query.eq('owner_id', profile.id);
}

/**
 * 搜尋查詢（跨全部月份、無日期範圍）。keyword 模式查 note ilike；
 * 有符合名稱的分類時「另發」一個 category_id in 查詢，由呼叫端合併——
 * 避開 PostgREST .or() 對關鍵字特殊字元（逗號、括號）的跳脫地雷。
 */
export function buildSearchQueries(ledgerType: LedgerType, profile: SearchProfile, mode: SearchMode) {
  if (mode.kind === 'category') {
    return [baseQuery(ledgerType, profile).eq('category_id', mode.categoryId)];
  }
  const queries = [baseQuery(ledgerType, profile).ilike('note', `%${escapeLikePattern(mode.keyword)}%`)];
  if (mode.categoryIds.length > 0) {
    queries.push(baseQuery(ledgerType, profile).in('category_id', mode.categoryIds));
  }
  return queries;
}

/**
 * 關鍵字／分類搜尋 hook。mode 為 null 時清空結果不查詢。
 * 呼叫端須以 useMemo 穩定 mode 物件，避免每次 render 重查。
 */
export function useTransactionSearch(ledgerType: LedgerType, mode: SearchMode | null) {
  const profile = useAuthStore((state) => state.profile);
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // 請求序號：連續輸入造成查詢重疊時，只有最新請求能更新狀態（比照 useTransactionsCore）。
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!profile?.family_id || !mode) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    const responses = await Promise.all(
      buildSearchQueries(ledgerType, { id: profile.id, family_id: profile.family_id }, mode)
    );
    if (requestId !== requestIdRef.current) return;

    const failed = responses.find((response) => response.error);
    if (failed) {
      console.error('[useTransactionSearch] 搜尋失敗', failed.error);
      setError(true);
    } else {
      setResults(mergeSearchResults(responses.flatMap((response) => parseTransactions(response.data))));
      setError(false);
    }
    setLoading(false);
  }, [ledgerType, mode, profile?.family_id, profile?.id]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  return { results, loading, error, refetch: runSearch };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/hooks/useTransactionSearch.test.ts && npx vitest run src/hooks/useTransactions.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTransactionSearch.ts src/hooks/useTransactionSearch.test.ts src/hooks/useTransactions.ts
git commit -m "feat(search): useTransactionSearch 跨月搜尋 hook（note ilike＋分類名稱雙查詢合併）"
```

---

### Task 5: `TransactionItem` 支援關鍵字高亮

**Files:**
- Modify: `src/components/transaction/TransactionItem.tsx`
- Test: `src/components/transaction/TransactionItem.test.tsx`（擴充既有檔案）

**Interfaces:**
- Consumes: Task 1 的 `splitHighlight`
- Produces: `TransactionItem` 新增選填 prop `highlightKeyword?: string`——備註中符合關鍵字的片段以 `<mark>` 呈現；未傳入時行為不變。

- [ ] **Step 1: 寫失敗測試**

`src/components/transaction/TransactionItem.test.tsx` 追加（測試檔既有的 transaction fixture 沿用，若名稱不同請對應調整）：

```tsx
it('有 highlightKeyword 時備註以 <mark> 高亮關鍵字', () => {
  render(
    <TransactionItem
      transaction={{ ...baseTransaction, note: '機票 東京' } as Transaction}
      highlightKeyword="機票"
    />
  );
  const marks = screen.getAllByText('機票', { selector: 'mark' });
  expect(marks).toHaveLength(1);
});

it('未傳 highlightKeyword 時不渲染 <mark>', () => {
  const { container } = render(
    <TransactionItem transaction={{ ...baseTransaction, note: '機票 東京' } as Transaction} />
  );
  expect(container.querySelector('mark')).toBeNull();
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/transaction/TransactionItem.test.tsx`
Expected: FAIL —— 找不到 `<mark>`。

- [ ] **Step 3: 實作**

`TransactionItem.tsx`：

1. props 介面加：

```ts
  /** 搜尋結果用：備註中此關鍵字以黃底 <mark> 高亮。 */
  highlightKeyword?: string;
```

（function 參數解構同步加上 `highlightKeyword`。）

2. import 加：

```ts
import { splitHighlight } from '../../lib/search';
```

3. 備註按鈕內文字 `{transaction.note}` 改為：

```tsx
{highlightKeyword
  ? splitHighlight(transaction.note, highlightKeyword).map((segment, index) =>
      segment.hit ? (
        <mark key={index} className="rounded bg-yellow-200 px-0.5">
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      )
    )
  : transaction.note}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/transaction/TransactionItem.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/transaction/TransactionItem.tsx src/components/transaction/TransactionItem.test.tsx
git commit -m "feat(search): TransactionItem 備註關鍵字高亮"
```

---

### Task 6: `TransactionSearchModal`（搜尋模式＋分類模式）

**Files:**
- Create: `src/components/transaction/TransactionSearchModal.tsx`
- Test: `src/components/transaction/TransactionSearchModal.test.tsx`

**Interfaces:**
- Consumes: Task 1 全部、Task 4 `useTransactionSearch`/`SearchMode`、Task 5 `TransactionItem highlightKeyword`、`TransactionForm`、`TransactionUpdateInput`（`src/hooks/useTransactions.ts`）、`useReferenceStore`（categories）、`useFamilyMembers`、`useUIStore.showToast`、`todayISO`、`formatAmount`
- Produces:

```ts
export interface CategoryDetailTarget {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
}

interface TransactionSearchModalProps {
  ledgerType: LedgerType;
  /** 有值＝分類明細模式；null/undefined＝關鍵字搜尋模式。 */
  category?: CategoryDetailTarget | null;
  onClose: () => void;
  onUpdate: (input: TransactionUpdateInput) => Promise<void>;
  onDelete: (transactionId: string) => Promise<void>;
}
```

- [ ] **Step 1: 寫失敗測試**

`src/components/transaction/TransactionSearchModal.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Transaction } from '../../types';

const searchState = {
  results: [] as Transaction[],
  loading: false,
  error: false,
  refetch: vi.fn()
};
vi.mock('../../hooks/useTransactionSearch', () => ({
  useTransactionSearch: vi.fn(() => searchState)
}));
vi.mock('../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({ members: [], loading: false })
}));
vi.mock('../../hooks/useEntrySuggestions', () => ({
  useEntrySuggestions: () => ({ noteHistory: [], noteDefaults: new Map() })
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [],
    loading: false,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn()
  })
}));

import { useReferenceStore } from '../../store/referenceStore';
import { useAuthStore } from '../../store/authStore';
import { TransactionSearchModal } from './TransactionSearchModal';

const tx = (overrides: Partial<Transaction>): Transaction =>
  ({
    id: 'id',
    family_id: 'fam1',
    owner_id: 'u1',
    ledger_type: 'family',
    type: 'expense',
    amount: 100,
    currency: 'TWD',
    category_id: 'c1',
    note: '機票 東京',
    transaction_date: '2026-07-12',
    created_at: '2026-07-12T00:00:00Z',
    updated_at: '2026-07-12T00:00:00Z',
    category: { id: 'c1', name: '旅遊', icon: '✈️', type: 'expense', is_shared: true },
    ...overrides
  } as Transaction);

const noop = async () => {};

function renderModal(props: Partial<Parameters<typeof TransactionSearchModal>[0]> = {}) {
  return render(
    <TransactionSearchModal ledgerType="family" onClose={vi.fn()} onUpdate={noop} onDelete={noop} {...props} />
  );
}

beforeEach(() => {
  searchState.results = [];
  searchState.loading = false;
  searchState.error = false;
  localStorage.clear();
  useAuthStore.setState({
    profile: { id: 'u1', family_id: 'fam1', display_name: '我', avatar_color: '#000', default_currency: 'TWD' }
  });
  useReferenceStore.setState({ categories: [] });
});

describe('搜尋模式', () => {
  it('輸入為空時顯示最近搜尋圓籤，點了帶入輸入框', () => {
    localStorage.setItem('fl:recent-searches:family', JSON.stringify(['機票', '全聯']));
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '機票' }));
    expect(screen.getByRole('searchbox')).toHaveValue('機票');
  });

  it('有結果時顯示總計與月份分組小計', () => {
    searchState.results = [
      tx({ id: 'a', transaction_date: '2026-07-12', amount: 28400 }),
      tx({ id: 'b', transaction_date: '2026-02-03', amount: 16800 })
    ];
    renderModal();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '機票' } });
    expect(screen.getByText(/共 2 筆/)).toBeInTheDocument();
    expect(screen.getByText('2026年7月')).toBeInTheDocument();
    expect(screen.getByText('2026年2月')).toBeInTheDocument();
  });

  it('篩選圓籤可縮小結果（型別）', () => {
    searchState.results = [
      tx({ id: 'a', type: 'expense', note: '機票 東京' }),
      tx({ id: 'b', type: 'income', note: '退機票' })
    ];
    renderModal();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '機票' } });
    fireEvent.click(screen.getByRole('button', { name: '收入' }));
    expect(screen.getByText(/共 1 筆/)).toBeInTheDocument();
  });

  it('無結果時顯示空狀態', () => {
    searchState.results = [];
    renderModal();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyz' } });
    expect(screen.getByText(/找不到符合/)).toBeInTheDocument();
  });

  it('搜尋失敗顯示錯誤與重試', () => {
    searchState.error = true;
    renderModal();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '機票' } });
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(searchState.refetch).toHaveBeenCalled();
  });
});

describe('分類模式', () => {
  const categoryProps = {
    category: { categoryId: 'c1', categoryName: '旅遊', categoryIcon: '✈️' }
  };

  it('顯示分類標題、無搜尋框、有期間篩選', () => {
    searchState.results = [tx({ id: 'a' })];
    renderModal(categoryProps);
    expect(screen.getByText('旅遊')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: '近3個月' })).toBeInTheDocument();
  });

  it('期間篩選過濾結果', () => {
    searchState.results = [
      tx({ id: 'recent', transaction_date: new Date().toISOString().slice(0, 10) }),
      tx({ id: 'old', transaction_date: '2020-01-01' })
    ];
    renderModal(categoryProps);
    expect(screen.getByText(/共 2 筆/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '近3個月' }));
    expect(screen.getByText(/共 1 筆/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/transaction/TransactionSearchModal.test.tsx`
Expected: FAIL —— 模組不存在。

- [ ] **Step 3: 實作 `TransactionSearchModal.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Currency, LedgerType, Transaction, TransactionType } from '../../types';
import type { TransactionUpdateInput } from '../../hooks/useTransactions';
import { useTransactionSearch, type SearchMode } from '../../hooks/useTransactionSearch';
import { useFamilyMembers } from '../../hooks/useFamilyMembers';
import { useReferenceStore } from '../../store/referenceStore';
import { useUIStore } from '../../store/uiStore';
import { formatAmount, CURRENCIES } from '../../lib/currency';
import { getErrorMessage } from '../../lib/errors';
import { todayISO } from '../../lib/utils';
import {
  addRecentSearch,
  filterByPeriod,
  filterSearchResults,
  groupByMonth,
  loadStringList,
  matchCategoryIds,
  recentSearchKey,
  saveStringList,
  sumByCurrency,
  SEARCH_RESULT_LIMIT,
  type Period,
  type SearchFilters
} from '../../lib/search';
import { TransactionItem } from './TransactionItem';
import { TransactionForm } from './TransactionForm';

export interface CategoryDetailTarget {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
}

interface TransactionSearchModalProps {
  ledgerType: LedgerType;
  /** 有值＝分類明細模式；null/undefined＝關鍵字搜尋模式。 */
  category?: CategoryDetailTarget | null;
  onClose: () => void;
  onUpdate: (input: TransactionUpdateInput) => Promise<void>;
  onDelete: (transactionId: string) => Promise<void>;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '3m', label: '近3個月' },
  { value: '6m', label: '近6個月' },
  { value: 'year', label: '今年' }
];

const DEBOUNCE_MS = 300;

/** 漸層玻璃卡片的共用樣式（U 方案）。 */
const glassCard = 'rounded-xl border border-white/80 bg-white/70 p-3 backdrop-blur';
const chipBase = 'rounded-full px-3 py-2 text-sm font-semibold transition';
const chipOff = 'border border-white/80 bg-white/60 text-slate-600 backdrop-blur';
const chipOn = 'bg-slate-900 text-white';

/** 淨額摘要文字：只列非零幣別，收入為正、支出為負。 */
function totalsText(totals: ReturnType<typeof sumByCurrency>): string {
  const parts = CURRENCIES.filter((currency) => totals[currency] !== 0).map((currency) => {
    const value = totals[currency];
    const sign = value > 0 ? '+' : '-';
    return `${sign}${formatAmount(Math.abs(value), currency)}`;
  });
  return parts.length > 0 ? ` · 合計 ${parts.join('、')}` : '';
}

export function TransactionSearchModal({
  ledgerType,
  category = null,
  onClose,
  onUpdate,
  onDelete
}: TransactionSearchModalProps) {
  const isFamily = ledgerType === 'family';
  const showToast = useUIStore((state) => state.showToast);
  const allCategories = useReferenceStore((state) => state.categories);
  const { members } = useFamilyMembers();

  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadStringList(localStorage, recentSearchKey(ledgerType))
  );
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // 輸入 300ms 後才觸發查詢，避免每個字元都打 Supabase。
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // Esc 關閉＋鎖背景捲動（比照 Modal；全螢幕覆蓋層同樣需要）。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      body.style.overflow = prevOverflow;
    };
    // onClose 以 render 當下的值即可（LedgerPage 傳入的為穩定 setState 包裝）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode: SearchMode | null = useMemo(() => {
    if (category) return { kind: 'category', categoryId: category.categoryId };
    const trimmed = debouncedKeyword.trim();
    if (!trimmed) return null;
    return { kind: 'keyword', keyword: trimmed, categoryIds: matchCategoryIds(allCategories, trimmed) };
  }, [category, debouncedKeyword, allCategories]);

  const { results, loading, error, refetch } = useTransactionSearch(ledgerType, mode);

  // 查詢成功且有結果時記錄最近搜尋（僅關鍵字模式）。
  const lastSavedRef = useRef('');
  useEffect(() => {
    if (mode?.kind !== 'keyword' || loading || error || results.length === 0) return;
    if (lastSavedRef.current === mode.keyword) return;
    lastSavedRef.current = mode.keyword;
    setRecentSearches((current) => {
      const next = addRecentSearch(current, mode.keyword);
      saveStringList(localStorage, recentSearchKey(ledgerType), next);
      return next;
    });
  }, [mode, loading, error, results, ledgerType]);

  const filtered = useMemo(() => {
    const filters: SearchFilters = { type: typeFilter, currency: currencyFilter, ownerId: ownerFilter };
    const base = filterSearchResults(results, filters);
    return category ? filterByPeriod(base, period, todayISO()) : base;
  }, [results, typeFilter, currencyFilter, ownerFilter, category, period]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  const totals = useMemo(() => sumByCurrency(filtered), [filtered]);

  async function handleEditSubmit(input: Omit<TransactionUpdateInput, 'id'>) {
    if (!editingTransaction) return;
    await onUpdate({ id: editingTransaction.id, ...input });
    showToast('交易已更新');
    setEditingTransaction(null);
    await refetch();
  }

  async function handleDelete(transactionId: string) {
    if (!window.confirm('確定刪除這筆交易？')) return;
    try {
      await onDelete(transactionId);
      showToast('交易已刪除');
      await refetch();
    } catch (deleteError) {
      showToast(getErrorMessage(deleteError, '刪除失敗，請稍後再試。'), 'error');
    }
  }

  const hasQuery = category != null || mode != null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={category ? `${category.categoryName} 分類明細` : '搜尋交易'}
      className={`fixed inset-0 z-40 overflow-y-auto bg-gradient-to-br ${
        isFamily ? 'from-emerald-100 via-teal-50 to-rose-100' : 'from-sky-100 via-indigo-50 to-rose-100'
      }`}
    >
      <div className="mx-auto grid max-w-3xl gap-4 p-4 pb-24">
        <header className="flex items-center gap-3">
          {category ? (
            <h1 className="flex flex-1 items-center gap-2 text-xl font-bold text-slate-900">
              <span aria-hidden="true">{category.categoryIcon}</span>
              {category.categoryName}
              <span className="text-sm font-medium text-slate-500">跨全部月份</span>
            </h1>
          ) : (
            <div className={`flex flex-1 items-center gap-2 ${glassCard}`}>
              <Search className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                role="searchbox"
                className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="搜尋備註或分類名稱…"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                autoFocus
              />
            </div>
          )}
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/80 bg-white/70 text-slate-600 backdrop-blur"
            onClick={onClose}
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* 最近搜尋：搜尋模式、輸入為空時顯示 */}
        {!category && !keyword.trim() && recentSearches.length > 0 ? (
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">最近搜尋</span>
            {recentSearches.map((item) => (
              <button
                key={item}
                type="button"
                className={`${chipBase} ${chipOff}`}
                onClick={() => setKeyword(item)}
              >
                {item}
              </button>
            ))}
          </section>
        ) : null}

        {/* 篩選列 */}
        {hasQuery ? (
          <section className="grid gap-2">
            {category ? (
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${chipBase} ${period === option.value ? chipOn : chipOff}`}
                    onClick={() => setPeriod(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', '全部'],
                    ['expense', '支出'],
                    ['income', '收入']
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${chipBase} ${typeFilter === value ? chipOn : chipOff}`}
                    onClick={() => setTypeFilter(value)}
                  >
                    {label}
                  </button>
                ))}
                {(['all', ...CURRENCIES] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${chipBase} ${currencyFilter === value ? chipOn : chipOff}`}
                    onClick={() => setCurrencyFilter(value)}
                  >
                    {value === 'all' ? '全部幣別' : value}
                  </button>
                ))}
              </div>
            )}
            {isFamily && members.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${chipBase} ${ownerFilter === 'all' ? chipOn : chipOff}`}
                  onClick={() => setOwnerFilter('all')}
                >
                  全部成員
                </button>
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`${chipBase} ${ownerFilter === member.id ? chipOn : chipOff}`}
                    onClick={() => setOwnerFilter(member.id)}
                  >
                    {member.display_name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 結果 */}
        {!hasQuery ? null : loading ? (
          <div className={`${glassCard} p-6 text-center text-slate-500`}>搜尋中...</div>
        ) : error ? (
          <div className={`${glassCard} p-6 text-center`}>
            <p className="text-sm text-slate-600">
              {typeof navigator !== 'undefined' && !navigator.onLine
                ? '目前離線，請連上網路後再試。'
                : '搜尋失敗，請稍後再試。'}
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void refetch()}
            >
              重試
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glassCard} border-dashed p-8 text-center text-slate-500`}>
            {category ? '這個分類還沒有交易。' : `找不到符合「${debouncedKeyword.trim()}」的交易。`}
          </div>
        ) : (
          <>
            <div className={`${glassCard} text-sm font-semibold text-slate-700`}>
              共 {filtered.length} 筆{totalsText(totals)}
              {results.length >= SEARCH_RESULT_LIMIT ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  僅顯示最近 {SEARCH_RESULT_LIMIT} 筆，可加關鍵字縮小範圍。
                </p>
              ) : null}
            </div>
            {groups.map((group) => (
              <section key={group.yearMonth} className="grid gap-3">
                <h2 className="flex items-baseline justify-between px-1 text-sm font-bold text-slate-600">
                  {group.label}
                  <span className="text-xs font-semibold text-slate-500">{totalsText(group.totals).replace(' · 合計 ', '')}</span>
                </h2>
                <ul className="grid grid-cols-1 gap-3">
                  {group.items.map((transaction) => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      highlightKeyword={mode?.kind === 'keyword' ? mode.keyword : undefined}
                      onEdit={setEditingTransaction}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      {editingTransaction ? (
        <TransactionForm
          initialLedgerType={editingTransaction.ledger_type}
          initialTransaction={editingTransaction}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingTransaction(null)}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/transaction/TransactionSearchModal.test.tsx`
Expected: PASS。若 `role="searchbox"` 查不到，改用 `screen.getByPlaceholderText('搜尋備註或分類名稱…')`（`<input type="search">` 的 implicit role 即 searchbox，通常可直接查）。

- [ ] **Step 5: Commit**

```bash
git add src/components/transaction/TransactionSearchModal.tsx src/components/transaction/TransactionSearchModal.test.tsx
git commit -m "feat(search): TransactionSearchModal 搜尋／分類明細全螢幕視窗（漸層玻璃風）"
```

---

### Task 7: `ExpenseCategorySummary` 可點＋`LedgerAnalysis` 傳遞

**Files:**
- Modify: `src/components/transaction/ExpenseCategorySummary.tsx`
- Modify: `src/components/transaction/LedgerAnalysis.tsx`
- Test: `src/components/transaction/ExpenseCategorySummary.test.tsx`（新檔）

**Interfaces:**
- Consumes: Task 6 的 `CategoryDetailTarget`
- Produces:
  - `ExpenseCategorySummary` 新 prop：`onSelectCategory?: (target: CategoryDetailTarget) => void`（未傳入時維持純顯示——Dashboard 不受影響）
  - `LedgerAnalysis` 新 prop：`onSelectCategory?: (target: CategoryDetailTarget) => void`，原樣傳給 `ExpenseCategorySummary`

- [ ] **Step 1: 寫失敗測試**

`src/components/transaction/ExpenseCategorySummary.test.tsx`：

```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CategoryExpenseSummary } from '../../types';
import { ExpenseCategorySummary } from './ExpenseCategorySummary';

const items: CategoryExpenseSummary[] = [
  {
    categoryId: 'c1',
    categoryName: '餐飲',
    categoryIcon: '🍜',
    totals: { TWD: 3240, USD: 0 },
    ratios: { TWD: 0.5, USD: 0 }
  }
];

describe('ExpenseCategorySummary onSelectCategory', () => {
  it('有傳入時列可點，回傳分類資訊', () => {
    const onSelect = vi.fn();
    render(<ExpenseCategorySummary items={items} currencyFilter="all" onSelectCategory={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /餐飲/ }));
    expect(onSelect).toHaveBeenCalledWith({ categoryId: 'c1', categoryName: '餐飲', categoryIcon: '🍜' });
  });

  it('未傳入時不渲染按鈕（維持純顯示）', () => {
    render(<ExpenseCategorySummary items={items} currencyFilter="all" />);
    expect(screen.queryByRole('button', { name: /餐飲/ })).toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/transaction/ExpenseCategorySummary.test.tsx`
Expected: FAIL —— prop 不存在／按鈕查不到。

- [ ] **Step 3: 實作**

`ExpenseCategorySummary.tsx`：

1. import 與 props：

```ts
import type { CategoryDetailTarget } from './TransactionSearchModal';

interface ExpenseCategorySummaryProps {
  items: CategoryExpenseSummary[];
  currencyFilter: Currency | 'all';
  title?: string;
  /** 傳入時分類列可點（開分類明細）；未傳入維持純顯示（Dashboard 用）。 */
  onSelectCategory?: (target: CategoryDetailTarget) => void;
}
```

2. 每列（`filteredItems.map` 內）的 `<div className="rounded-lg bg-slate-50 px-3 py-3">…</div>` 外面依 prop 包一層：

```tsx
{filteredItems.map((item) => {
  const row = (
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      {/* …原本的列內容不動… */}
    </div>
  );
  return onSelectCategory ? (
    <button
      key={`${currency}-${item.categoryId}`}
      type="button"
      className="w-full text-left transition active:opacity-70"
      onClick={() =>
        onSelectCategory({
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          categoryIcon: item.categoryIcon
        })
      }
    >
      {row}
    </button>
  ) : (
    <div key={`${currency}-${item.categoryId}`}>{row}</div>
  );
})}
```

（原本掛在列上的 `key` 移到外層包裝元素。）

`LedgerAnalysis.tsx`：props 加 `onSelectCategory?: (target: CategoryDetailTarget) => void`（import type 自 `./TransactionSearchModal`），並傳給 `<ExpenseCategorySummary … onSelectCategory={onSelectCategory} />`。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/transaction/ExpenseCategorySummary.test.tsx && npm test`
Expected: PASS（Dashboard 未傳 prop、行為不變）。

- [ ] **Step 5: Commit**

```bash
git add src/components/transaction/ExpenseCategorySummary.tsx src/components/transaction/LedgerAnalysis.tsx src/components/transaction/ExpenseCategorySummary.test.tsx
git commit -m "feat(search): 支出分類列可點入分類明細"
```

---

### Task 8: `TransactionForm` 備註圓籤——聰明帶入＋釘選

**Files:**
- Modify: `src/components/transaction/TransactionForm.tsx`
- Test: `src/components/transaction/TransactionForm.test.tsx`（新檔）

**Interfaces:**
- Consumes: Task 2 `mergeNoteSuggestions`/`togglePin`/`pinnedNotesKey`/`NoteDefaults`、Task 3 `useEntrySuggestions` 的 `{ noteHistory, noteDefaults }`、Task 1 `loadStringList`/`saveStringList`
- Produces: 無新對外介面（表單內部行為）。

- [ ] **Step 1: 寫失敗測試**

`src/components/transaction/TransactionForm.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { NoteDefaults } from '../../lib/suggestions';

const noteDefaults = new Map<string, NoteDefaults>([
  ['星巴克', { category_id: 'c-food', amount: 150, currency: 'TWD', payment_method: 'card' }]
]);
vi.mock('../../hooks/useEntrySuggestions', () => ({
  useEntrySuggestions: () => ({ noteHistory: ['星巴克', '加油'], noteDefaults })
}));
vi.mock('../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({ members: [], loading: false })
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [
      { id: 'c-food', name: '餐飲', icon: '🍜', type: 'expense', is_shared: true },
      { id: 'c-car', name: '交通', icon: '🚗', type: 'expense', is_shared: true }
    ],
    loading: false,
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn()
  })
}));

import { useAuthStore } from '../../store/authStore';
import { TransactionForm } from './TransactionForm';

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    profile: { id: 'u1', family_id: 'fam1', display_name: '我', avatar_color: '#000', default_currency: 'TWD' }
  });
});

function renderForm() {
  return render(
    <TransactionForm initialLedgerType="family" onSubmit={vi.fn(async () => {})} onClose={vi.fn()} />
  );
}

describe('聰明帶入', () => {
  it('點備註圓籤帶入備註＋分類＋付款方式；金額空白時帶入金額', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '星巴克' }));
    expect(screen.getByPlaceholderText('晚餐、機票、生活用品...')).toHaveValue('星巴克');
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
  });

  it('金額已輸入時不覆蓋', () => {
    renderForm();
    const amountInput = screen.getByDisplayValue(''); // AmountInput 的輸入框；查法依實際 DOM 調整
    fireEvent.change(amountInput, { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: '星巴克' }));
    expect(screen.getByDisplayValue('999')).toBeInTheDocument();
  });
});

describe('釘選', () => {
  it('右鍵（contextmenu）釘選後圓籤帶 📌 並寫入 localStorage', () => {
    renderForm();
    fireEvent.contextMenu(screen.getByRole('button', { name: '加油' }));
    expect(screen.getByRole('button', { name: /📌.*加油/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('fl:pinned-notes:family:expense') ?? '[]')).toEqual(['加油']);
  });
});
```

（AmountInput 的實際 DOM 查法在實作時打開 `src/components/common/AmountInput.tsx` 確認，用 placeholder 或 label 查詢皆可；測試意圖不變：金額空→帶入、金額有值→不覆蓋。）

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/transaction/TransactionForm.test.tsx`
Expected: FAIL —— 點圓籤只設 note，不帶分類金額；無 📌。

- [ ] **Step 3: 實作**

`TransactionForm.tsx` 修改：

1. import 調整：

```ts
import { mergeNoteSuggestions, pinnedNotesKey, togglePin } from '../../lib/suggestions';
import { loadStringList, saveStringList } from '../../lib/search';
import { useUIStore } from '../../store/uiStore';
```

（移除既有的 `filterNotes` import。）

2. 元件內，取代 `const noteSuggestions = filterNotes(noteHistory, note);`：

```tsx
  const { noteHistory, noteDefaults } = useEntrySuggestions(ledgerType, type);
  const showToast = useUIStore((state) => state.showToast);
  const [pinnedNotes, setPinnedNotes] = useState<string[]>([]);

  // 釘選清單依帳本／收支型別分開存；切換時重讀。
  useEffect(() => {
    setPinnedNotes(loadStringList(localStorage, pinnedNotesKey(ledgerType, type)));
  }, [ledgerType, type]);

  const noteSuggestions = mergeNoteSuggestions(pinnedNotes, noteHistory, note);

  /** 點圓籤：帶入備註＋該備註上次的分類與付款方式；金額只在尚未輸入時帶入（不覆蓋）。 */
  function applySuggestion(suggestion: string) {
    setNote(suggestion);
    const defaults = noteDefaults.get(suggestion);
    if (!defaults) return;
    if (defaults.category_id && categories.some((category) => category.id === defaults.category_id)) {
      setCategoryId(defaults.category_id);
    }
    if (defaults.payment_method) setPaymentMethod(defaults.payment_method);
    if (!amount.trim() && defaults.amount != null) {
      if (defaults.currency) setCurrency(defaults.currency);
      setAmount(String(defaults.amount));
    }
  }

  function togglePinned(suggestion: string) {
    const next = togglePin(pinnedNotes, suggestion);
    setPinnedNotes(next);
    saveStringList(localStorage, pinnedNotesKey(ledgerType, type), next);
    showToast(next.includes(suggestion) ? '已釘選常用備註' : '已取消釘選');
  }

  // 觸控長按釘選：500ms 觸發；觸發後抑制同一次點擊的帶入。
  const longPressRef = useRef<{ timer: number; fired: boolean }>({ timer: 0, fired: false });
  function startLongPress(suggestion: string, pointerType: string) {
    if (pointerType !== 'touch') return; // 桌面用右鍵（contextmenu）
    longPressRef.current.fired = false;
    longPressRef.current.timer = window.setTimeout(() => {
      longPressRef.current.fired = true;
      togglePinned(suggestion);
    }, 500);
  }
  function cancelLongPress() {
    window.clearTimeout(longPressRef.current.timer);
  }
  function handleSuggestionClick(suggestion: string) {
    if (longPressRef.current.fired) {
      longPressRef.current.fired = false;
      return;
    }
    applySuggestion(suggestion);
  }
```

（`useRef` 需加入 react import；`useEffect`、`useState` 已有。）

3. 圓籤 JSX 改為：

```tsx
{noteSuggestions.map((suggestion) => {
  const pinned = pinnedNotes.includes(suggestion);
  return (
    <button
      key={suggestion}
      type="button"
      className={`max-w-[14rem] truncate rounded-full border px-3 py-1 text-xs active:bg-slate-50 ${
        pinned ? 'border-family bg-familySoft text-family' : 'border-slate-200 bg-white text-slate-600'
      }`}
      onClick={() => handleSuggestionClick(suggestion)}
      onContextMenu={(event) => {
        event.preventDefault();
        togglePinned(suggestion);
      }}
      onPointerDown={(event) => startLongPress(suggestion, event.pointerType)}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      title="點一下帶入；長按（或右鍵）釘選"
    >
      {pinned ? '📌 ' : ''}
      {suggestion}
    </button>
  );
})}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/transaction/TransactionForm.test.tsx && npm test`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/transaction/TransactionForm.tsx src/components/transaction/TransactionForm.test.tsx
git commit -m "feat(suggestions): 備註圓籤聰明帶入＋長按/右鍵釘選"
```

---

### Task 9: `LedgerPage` 整線＋全量驗證

**Files:**
- Modify: `src/pages/LedgerPage.tsx`

**Interfaces:**
- Consumes: Task 6 `TransactionSearchModal`/`CategoryDetailTarget`、Task 7 `LedgerAnalysis onSelectCategory`、既有 `updateTransaction`/`deleteTransaction`（異動後自動 `refreshTransactions`，帳本頁資料同步不需額外接線）

- [ ] **Step 1: 實作接線**

`LedgerPage.tsx` 修改：

1. import：

```ts
import { Search } from 'lucide-react';
import { TransactionSearchModal, type CategoryDetailTarget } from '../components/transaction/TransactionSearchModal';
```

2. 元件內加狀態：

```tsx
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<CategoryDetailTarget | null>(null);
```

3. `<MonthPicker …>` 那行改為（月份選擇器旁加 🔍）：

```tsx
      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <MonthPicker value={yearMonth} onChange={setYearMonth} />
        </div>
        <button
          type="button"
          className="grid w-14 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:text-family"
          onClick={() => setSearchOpen(true)}
          aria-label="搜尋交易"
          title="搜尋備註（跨全部月份）"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
```

4. `<LedgerAnalysis …>` 加 prop：`onSelectCategory={setCategoryTarget}`。

5. `return` 內最後（`TransactionForm` 條件渲染之後）加：

```tsx
      {searchOpen || categoryTarget ? (
        <TransactionSearchModal
          ledgerType={ledgerType}
          category={categoryTarget}
          onClose={() => {
            setSearchOpen(false);
            setCategoryTarget(null);
          }}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
        />
      ) : null}
```

- [ ] **Step 2: 全量測試＋lint＋build**

Run: `npm test && npm run lint && npm run build`
Expected: 全部通過、無 type error。lint 若對 `eslint-disable-next-line` 位置有意見，依訊息修正。

- [ ] **Step 3: 瀏覽器驗證（dev server）**

啟動 dev server 後逐項驗證：

1. 家庭帳本 → 🔍 → 輸入既有備註關鍵字 → 跨月結果出現、關鍵字黃底、月小計正確。
2. 清空輸入 → 最近搜尋圓籤出現，點選可重搜。
3. 篩選籤（支出/收入、幣別）縮小結果，總計同步變化。
4. 點結果一筆 → 編輯 → 儲存 → 搜尋結果與帳本頁清單同步更新。
5. 圖表分析 → 本月支出分類 → 點一列 → 分類明細（跨月）→ 期間籤過濾正確。
6. 記帳表單 → 備註圓籤：點帶入分類/金額/付款方式；長按（模擬觸控）或右鍵釘選 → 📌 排最前；重開表單仍在。
7. 個人帳本重複 1、5（確認漸層底色為 personal 色系）。

- [ ] **Step 4: Commit**

```bash
git add src/pages/LedgerPage.tsx
git commit -m "feat(search): 帳本頁接上關鍵字搜尋與分類明細"
```

---

## Self-Review 紀錄

- **Spec 覆蓋**：搜尋（C）→ Task 1/4/6/9；最近搜尋 → Task 1/6；分類名稱比對（L）→ Task 1/4/6；篩選列（M）→ Task 1/6；分類點入（I）→ Task 6/7/9；備註歷史 D/J/O → Task 2/3/8；高亮 → Task 1/5；玻璃風（U）→ Task 6；錯誤處理/離線/空狀態 → Task 6；300 筆上限提示 → Task 6。
- **與 spec 的一個實作偏差**：spec 提到以 `.or()` 合併 note/分類條件；實作改為「兩個查詢＋前端合併」（`mergeSearchResults`），避開 PostgREST or-syntax 對逗號/括號的跳脫問題，結果等價。已在 Task 4 代碼註解中說明。
- **型別一致性**：`CategoryDetailTarget` 定義於 Task 6、Task 7/9 引用同名；`SearchMode`/`NoteDefaults`/`Period` 簽名在各 Task 一致。
