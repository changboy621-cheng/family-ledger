import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import { parseCSV } from './csv';
import { guessCategoryId, invoiceNote, looksLikeEInvoice, normalizeInvoiceDate, parseEInvoiceText } from './einvoice';

// 以下皆為合成的示範資料。
const PIPE = [
  '表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|',
  '明細=D|發票號碼|小計|品項名稱|',
  'M|手機條碼|/DEMO123|20261101|00000001|示範超市|AB12345678|486|開立|',
  'D|AB12345678|99|鮮奶|',
  'D|AB12345678|387|衛生紙|',
  'M|手機條碼|/DEMO123|20261102|00000002|示範咖啡|CD87654321|150|作廢|',
  'M|手機條碼|/DEMO123|壞日期|00000003|示範店|EF11112222|80|開立|'
].join('\n');

const CSV = [
  '載具自訂名稱,發票日期,發票號碼,發票金額,發票狀態,賣方統一編號,賣方名稱,消費明細_品名',
  '手機,2026/11/03,GH-22223333,1200,已確認,00000004,示範加油站,汽油',
  '手機,2026/11/04,JK44445555,320,已確認,00000005,示範影城,電影票',
  '手機,2026/11/04,JK44445555,320,已確認,00000005,示範影城,爆米花'
].join('\n');

const cat = (id: string, name: string): Category => ({ id, name, icon: '•', type: 'expense', is_shared: true });

describe('einvoice', () => {
  it('解析直線分隔格式：合併品項、略過作廢、計算壞列', () => {
    const result = parseEInvoiceText(PIPE, parseCSV);
    expect(result.invoices).toEqual([
      { number: 'AB12345678', date: '2026-11-01', seller: '示範超市', sellerId: '00000001', total: 486, items: ['鮮奶', '衛生紙'] }
    ]);
    expect(result.voided).toBe(1);
    expect(result.invalid).toBe(1);
  });

  it('解析逗號 CSV：同發票多列合併、發票號碼去掉連字號', () => {
    const result = parseEInvoiceText(CSV, parseCSV);
    expect(result.invoices.map((invoice) => [invoice.number, invoice.date, invoice.total, invoice.items.length])).toEqual([
      ['GH22223333', '2026-11-03', 1200, 1],
      ['JK44445555', '2026-11-04', 320, 2]
    ]);
  });

  it('辨識檔案格式', () => {
    expect(looksLikeEInvoice(PIPE)).toBe(true);
    expect(looksLikeEInvoice(CSV)).toBe(true);
    expect(looksLikeEInvoice('日期,帳本,類型,類別,金額')).toBe(false);
  });

  it('日期支援西元與民國', () => {
    expect(normalizeInvoiceDate('20261101')).toBe('2026-11-01');
    expect(normalizeInvoiceDate('115/11/01')).toBe('2026-11-01');
    expect(normalizeInvoiceDate('1151101')).toBe('2026-11-01');
    expect(normalizeInvoiceDate('2026-13-01')).toBeNull();
  });

  it('依店名猜分類，猜不到用「其他」', () => {
    const categories = [cat('food', '餐飲'), cat('car', '交通'), cat('daily', '日用品'), cat('other', '其他')];
    expect(guessCategoryId({ seller: '示範加油站', items: ['汽油'] }, categories)).toBe('car');
    expect(guessCategoryId({ seller: '全聯福利中心', items: [] }, categories)).toBe('daily');
    expect(guessCategoryId({ seller: '某某公司', items: [] }, categories)).toBe('other');
  });

  it('備註為店名加前兩個品項', () => {
    expect(invoiceNote({ seller: '示範超市', items: ['鮮奶', '衛生紙', '雞蛋'] })).toBe('示範超市：鮮奶、衛生紙');
  });
});
