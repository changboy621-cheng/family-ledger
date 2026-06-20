import { describe, expect, it } from 'vitest';
import { detectAndroMoney, parseAndroMoney } from './importAdapters';

const rows: string[][] = [
  ['Google Documents', '理財幫手AndroMoney', '2026/06/20', '', '', '', '', '', '', ''],
  ['Id', '幣別', '金額', '分類', '子分類', '日期', '付款(轉出)', '收款(轉入)', '備註', 'Periodic', '專案', '商家(公司)', 'uid', '時間', 'status'],
  ['1', 'TWD', '66262', 'SYSTEM', 'INIT_AMOUNT', '10100101', '', '國泰世華', '', '', '', '', 'u1', '', ''],
  ['49', 'TWD', '88691', '其他', '玉山卡費', '20190627', '國泰世華', '', '卡費', '', '', '', 'u2', '56', ''],
  ['50', 'TWD', '30000', '薪水', '', '20190701', '', '國泰世華', '六月薪', '', '', '公司', 'u3', '', ''],
  ['51', 'TWD', '5000', '轉帳', '', '20190702', '現金', '國泰世華', '', '', '', '', 'u4', '', ''],
  ['52', 'TWD', '150', '餐飲', '午餐', '20190703', '現金', '', '', '', '', '', 'u5', '', '']
];

describe('detectAndroMoney', () => {
  it('從標題或欄位辨識 AndroMoney 格式', () => {
    expect(detectAndroMoney(rows)).toBe(true);
    expect(detectAndroMoney([['日期', '金額', '類別']])).toBe(false);
  });
});

describe('parseAndroMoney', () => {
  it('略過期初餘額與轉帳，正確解析收支', () => {
    const { records, skipped } = parseAndroMoney(rows);
    expect(records).toHaveLength(3);
    expect(skipped).toBe(2); // 期初(1) + 轉帳(1)
  });

  it('支出：用付款帳戶判斷、轉 8 碼日期、推付款方式', () => {
    const { records } = parseAndroMoney(rows);
    expect(records[0]).toMatchObject({
      type: 'expense',
      amount: 88691,
      categoryName: '其他',
      transaction_date: '2019-06-27',
      currency: 'TWD',
      paymentMethod: 'card',
      note: '卡費'
    });
  });

  it('收入：用收款帳戶判斷、備註含商家', () => {
    const { records } = parseAndroMoney(rows);
    expect(records[1]).toMatchObject({ type: 'income', amount: 30000, categoryName: '薪水', note: '六月薪 公司' });
  });

  it('現金帳戶推為現金、可指定匯入到個人帳本', () => {
    const { records } = parseAndroMoney(rows, 'personal');
    expect(records[2]).toMatchObject({ type: 'expense', categoryName: '餐飲', paymentMethod: 'cash', ledger_type: 'personal' });
  });
});
