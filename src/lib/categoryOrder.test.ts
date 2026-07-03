import { describe, expect, it } from 'vitest';
import { arrayMove, sortByCategoryOrder } from './categoryOrder';

type Cat = { id: string; sort_order?: number };

describe('sortByCategoryOrder', () => {
  it('依 order 陣列的順序排列', () => {
    const items: Cat[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const sorted = sortByCategoryOrder(items, ['c', 'a', 'b']);
    expect(sorted.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('未列進 order 者排在後面，並依 sort_order 備援', () => {
    const items: Cat[] = [
      { id: 'x', sort_order: 30 },
      { id: 'a' },
      { id: 'w', sort_order: 10 }
    ];
    // 只有 a 被指定順序；x、w 退回 sort_order（w 10 < x 30）
    const sorted = sortByCategoryOrder(items, ['a']);
    expect(sorted.map((c) => c.id)).toEqual(['a', 'w', 'x']);
  });

  it('order 為空時完全退回 sort_order', () => {
    const items: Cat[] = [
      { id: 'b', sort_order: 20 },
      { id: 'a', sort_order: 10 }
    ];
    expect(sortByCategoryOrder(items, []).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('不修改輸入陣列', () => {
    const items: Cat[] = [{ id: 'a' }, { id: 'b' }];
    sortByCategoryOrder(items, ['b', 'a']);
    expect(items.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('arrayMove', () => {
  it('往後移', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('往前移', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('to 越界會被夾住到尾端', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
  });

  it('from 越界則原封回傳', () => {
    expect(arrayMove(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('不修改輸入陣列', () => {
    const list = ['a', 'b', 'c'];
    arrayMove(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
