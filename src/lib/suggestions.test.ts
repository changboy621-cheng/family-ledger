import { describe, expect, it } from 'vitest';
import { computeFrequentItems, computeRecentNotes, filterNotes, type EntryRow } from './suggestions';

function row(categoryId: string, name: string, icon: string, note: string | null, date: string): EntryRow {
  return { category_id: categoryId, note, transaction_date: date, category: { name, icon } };
}

const rows: EntryRow[] = [
  row('food', '餐飲', '🍽️', '午餐便當', '2026-06-19'),
  row('food', '餐飲', '🍽️', '午餐便當', '2026-06-18'),
  row('food', '餐飲', '🍽️', '晚餐', '2026-06-17'),
  row('home', '居家', '🏠', '衛生紙', '2026-06-16'),
  row('food', '餐飲', '🍽️', '午餐便當', '2026-06-15')
];

describe('computeFrequentItems', () => {
  it('依「類別＋備註」出現次數由多到少排序', () => {
    const items = computeFrequentItems(rows);
    expect(items[0]).toMatchObject({ categoryId: 'food', note: '午餐便當', count: 3 });
  });

  it('限制回傳數量', () => {
    expect(computeFrequentItems(rows, 2)).toHaveLength(2);
  });
});

describe('computeRecentNotes', () => {
  it('取不重複的備註、最近的在前', () => {
    expect(computeRecentNotes(rows)).toEqual(['午餐便當', '晚餐', '衛生紙']);
  });

  it('忽略空白備註', () => {
    const withBlank = [...rows, row('x', 'X', '❓', '   ', '2026-06-14')];
    expect(computeRecentNotes(withBlank)).not.toContain('   ');
  });
});

describe('filterNotes', () => {
  it('空字串回傳全部（受上限）', () => {
    expect(filterNotes(['午餐便當', '晚餐'], '', 5)).toEqual(['午餐便當', '晚餐']);
  });

  it('依輸入子字串過濾', () => {
    expect(filterNotes(['午餐便當', '晚餐', '午茶'], '午')).toEqual(['午餐便當', '午茶']);
  });

  it('排除與輸入完全相同者（已經打完了不用再提示）', () => {
    expect(filterNotes(['午餐', '午餐便當'], '午餐')).toEqual(['午餐便當']);
  });
});
