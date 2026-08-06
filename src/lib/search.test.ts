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
