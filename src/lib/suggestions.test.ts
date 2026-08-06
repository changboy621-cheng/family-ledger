import { describe, expect, it } from 'vitest';
import {
  buildNoteDefaults,
  computeRecentNotes,
  filterNotes,
  mergeNoteSuggestions,
  pinnedNotesKey,
  togglePin,
  type EntryRow
} from './suggestions';

function row(note: string | null, date: string): EntryRow {
  return { note, transaction_date: date };
}

const rows: EntryRow[] = [
  row('午餐便當', '2026-06-19'),
  row('午餐便當', '2026-06-18'),
  row('晚餐', '2026-06-17'),
  row('衛生紙', '2026-06-16'),
  row('午餐便當', '2026-06-15')
];

describe('computeRecentNotes', () => {
  it('取不重複的備註、最近的在前', () => {
    expect(computeRecentNotes(rows)).toEqual(['午餐便當', '晚餐', '衛生紙']);
  });

  it('忽略空白備註', () => {
    const withBlank = [...rows, row('   ', '2026-06-14')];
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
