import { describe, expect, it } from 'vitest';
import { parseQuickEntry } from './quickEntry';

const categories = ['餐飲', '居家', '交通', '醫療'];

describe('parseQuickEntry', () => {
  it('解析「金額 類別」', () => {
    expect(parseQuickEntry('200 餐飲', categories)).toEqual({
      amount: 200,
      type: 'expense',
      ledgerType: 'family',
      paymentMethod: null,
      categoryName: '餐飲',
      note: ''
    });
  });

  it('辨識刷卡/現金關鍵字', () => {
    expect(parseQuickEntry('刷卡 1200 餐飲', categories)).toMatchObject({ paymentMethod: 'card', amount: 1200, categoryName: '餐飲' });
    expect(parseQuickEntry('現金 50 交通', categories)).toMatchObject({ paymentMethod: 'cash', categoryName: '交通' });
  });

  it('解析「類別 金額 備註」並順序不拘', () => {
    expect(parseQuickEntry('餐飲 200 午餐便當', categories)).toMatchObject({
      amount: 200,
      categoryName: '餐飲',
      note: '午餐便當'
    });
  });

  it('辨識千分位逗號', () => {
    expect(parseQuickEntry('居家 1,099 衛生紙', categories)).toMatchObject({ amount: 1099, categoryName: '居家' });
  });

  it('辨識收入關鍵字', () => {
    expect(parseQuickEntry('收入 5000 獎金', categories)).toMatchObject({ type: 'income', amount: 5000, note: '獎金' });
  });

  it('辨識個人帳本關鍵字', () => {
    expect(parseQuickEntry('個人 100 交通 加值', categories)).toMatchObject({
      ledgerType: 'personal',
      amount: 100,
      categoryName: '交通',
      note: '加值'
    });
  });

  it('對不到類別時 categoryName 為 null、其餘進備註', () => {
    expect(parseQuickEntry('300 不明項目', categories)).toMatchObject({ amount: 300, categoryName: null, note: '不明項目' });
  });

  it('沒有金額回傳 null', () => {
    expect(parseQuickEntry('餐飲 午餐', categories)).toBeNull();
    expect(parseQuickEntry('', categories)).toBeNull();
  });
});
