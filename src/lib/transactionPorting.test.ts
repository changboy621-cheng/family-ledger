import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { EXPORT_HEADER, buildExportRows, parseImportRecords } from './transactionPorting';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    family_id: 'f',
    owner_id: 'o',
    ledger_type: 'family',
    type: 'expense',
    amount: 1099,
    currency: 'TWD',
    category_id: 'c',
    note: '衛生紙',
    transaction_date: '2026-06-19',
    created_at: '',
    updated_at: '',
    category: { id: 'c', name: '居家', icon: '🏠', type: 'expense', is_shared: true },
    owner: { id: 'o', family_id: 'f', display_name: '老婆', avatar_color: '#000', default_currency: 'TWD' },
    ...partial
  };
}

describe('buildExportRows', () => {
  it('把交易轉成中文欄位的列（含付款方式）', () => {
    const rows = buildExportRows([tx({ payment_method: 'card' })]);
    expect(rows[0]).toEqual(['2026-06-19', '家庭', '支出', '居家', '1099', 'TWD', '刷卡', '衛生紙', '老婆']);
  });
});

describe('parseImportRecords', () => {
  it('依欄名自動辨識並轉成匯入紀錄', () => {
    const rows = [
      ['日期', '帳本', '類型', '類別', '金額', '幣別', '付款方式', '備註'],
      ['2026-06-19', '個人', '支出', '餐飲', 'NT$1,099', 'TWD', '刷卡', '午餐']
    ];
    const { records, skipped } = parseImportRecords(rows);
    expect(skipped).toBe(0);
    expect(records[0]).toEqual({
      transaction_date: '2026-06-19',
      ledger_type: 'personal',
      type: 'expense',
      categoryName: '餐飲',
      amount: 1099,
      currency: 'TWD',
      paymentMethod: 'card',
      note: '午餐'
    });
  });

  it('日期不合法、金額非正、或無類別的列會略過', () => {
    const rows = [
      ['日期', '類別', '金額'],
      ['壞日期', '餐飲', '100'],
      ['2026-06-19', '餐飲', '0'],
      ['2026-06-19', '', '100'],
      ['2026-06-19', '餐飲', '50']
    ];
    const { records, skipped } = parseImportRecords(rows);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it('英文欄名也能辨識，缺欄用預設值', () => {
    const rows = [
      ['date', 'category', 'amount'],
      ['2026-06-19', 'Food', '200']
    ];
    const { records } = parseImportRecords(rows);
    expect(records[0]).toMatchObject({ ledger_type: 'family', type: 'expense', currency: 'TWD', categoryName: 'Food' });
  });

  it('自家匯出的 CSV 可被重新解析（round-trip 欄名相容）', () => {
    expect(EXPORT_HEADER).toContain('日期');
    const exported = buildExportRows([tx({ ledger_type: 'personal', note: '衛生紙, 兩串' })]);
    const { records, skipped } = parseImportRecords([EXPORT_HEADER, ...exported]);
    expect(skipped).toBe(0);
    expect(records[0]).toMatchObject({ categoryName: '居家', amount: 1099, ledger_type: 'personal', note: '衛生紙, 兩串' });
  });
});
