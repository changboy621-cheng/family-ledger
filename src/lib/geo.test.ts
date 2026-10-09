import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { buildMapPlaces, isValidCoordinates, markerRadius, roundCoordinate } from './geo';
import { resolveLocationPatch } from '../hooks/useTransactions';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    family_id: 'f',
    owner_id: 'o',
    ledger_type: 'family',
    type: 'expense',
    amount: 100,
    currency: 'TWD',
    category_id: 'c',
    transaction_date: '2026-10-01',
    created_at: '',
    updated_at: '',
    ...overrides
  };
}

describe('buildMapPlaces', () => {
  it('同一商圈的多筆支出合併，累計金額與筆數，取最常用名稱', () => {
    const places = buildMapPlaces([
      tx({ id: '1', latitude: 25.0331, longitude: 121.5654, place_name: '101', amount: 300 }),
      tx({ id: '2', latitude: 25.0334, longitude: 121.5651, place_name: '101', amount: 200, transaction_date: '2026-10-05' }),
      tx({ id: '3', latitude: 25.0332, longitude: 121.5655, place_name: '信義', amount: 50 })
    ]);
    expect(places).toHaveLength(1);
    expect(places[0].count).toBe(3);
    expect(places[0].totals.TWD).toBe(550);
    expect(places[0].name).toBe('101');
    expect(places[0].lastDate).toBe('2026-10-05');
  });

  it('忽略收入、沒定位與座標不合法的列；不同幣別分開累計', () => {
    const places = buildMapPlaces([
      tx({ id: '1', type: 'income', latitude: 1, longitude: 1 }),
      tx({ id: '2' }),
      tx({ id: '3', latitude: 95, longitude: 10 }),
      tx({ id: '4', latitude: 35.68, longitude: 139.76, currency: 'USD', amount: 12.5 })
    ]);
    expect(places).toHaveLength(1);
    expect(places[0].totals).toEqual({ TWD: 0, USD: 12.5 });
  });

  it('依筆數由多到少排序', () => {
    const places = buildMapPlaces([
      tx({ id: '1', latitude: 10, longitude: 10 }),
      tx({ id: '2', latitude: 20, longitude: 20 }),
      tx({ id: '3', latitude: 20, longitude: 20 })
    ]);
    expect(places.map((place) => place.count)).toEqual([2, 1]);
  });
});

describe('座標工具', () => {
  it('roundCoordinate 取到小數 6 位', () => {
    expect(roundCoordinate(25.03312345678)).toBe(25.033123);
  });
  it('isValidCoordinates 檢查範圍與型別', () => {
    expect(isValidCoordinates(25, 121)).toBe(true);
    expect(isValidCoordinates(91, 0)).toBe(false);
    expect(isValidCoordinates(0, 181)).toBe(false);
    expect(isValidCoordinates(NaN, 0)).toBe(false);
  });
  it('markerRadius 隨金額遞增且有上下限', () => {
    expect(markerRadius(0, 100)).toBe(6);
    expect(markerRadius(100, 100)).toBe(28);
    expect(markerRadius(25, 100)).toBeGreaterThan(6);
    expect(markerRadius(25, 100)).toBeLessThan(28);
  });
});

describe('resolveLocationPatch', () => {
  it('經緯度成對才寫入，名稱去空白', () => {
    expect(resolveLocationPatch({ latitude: 1, longitude: 2, place_name: ' 全聯 ' })).toEqual({
      latitude: 1,
      longitude: 2,
      place_name: '全聯'
    });
  });
  it('缺座標或移除位置時整組清成 null', () => {
    expect(resolveLocationPatch({ latitude: 1, longitude: null, place_name: 'x' })).toEqual({
      latitude: null,
      longitude: null,
      place_name: null
    });
    expect(resolveLocationPatch({})).toEqual({ latitude: null, longitude: null, place_name: null });
  });
});
