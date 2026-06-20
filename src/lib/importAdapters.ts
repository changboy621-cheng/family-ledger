// 各家記帳 App 的 CSV 格式差異很大，這裡放「專用格式轉換器」。
// 目前支援 AndroMoney（理財幫手）：跳過垃圾標題行、轉 8 碼日期、用付款/收款帳戶欄判斷收支、略過期初餘額與轉帳。
import type { LedgerType, PaymentMethod } from '../types';
import { normalizeDate, type ImportRecord } from './transactionPorting';

export function detectAndroMoney(rows: string[][]): boolean {
  const head = rows.slice(0, 3).flat().join(',');
  if (head.includes('AndroMoney')) return true;
  return rows.some((row) => row.some((cell) => cell.includes('付款(轉出)') || cell.includes('收款(轉入)')));
}

function findHeaderIndex(rows: string[][]): number {
  return rows.findIndex((row) => row.includes('金額') && row.includes('日期'));
}

function amountOf(raw: string): number {
  const value = Number((raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function inferPayment(account: string, sub: string): PaymentMethod | null {
  const text = `${account}${sub}`;
  if (/現金|cash/i.test(text)) return 'cash';
  if (/卡|信用|card/i.test(text)) return 'card';
  return null;
}

export function parseAndroMoney(rows: string[][], ledgerType: LedgerType = 'family'): { records: ImportRecord[]; skipped: number } {
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) return { records: [], skipped: 0 };

  const header = rows[headerIndex];
  const idx = (kw: string) => header.findIndex((cell) => cell.includes(kw));
  const cols = {
    currency: idx('幣別'),
    amount: idx('金額'),
    category: header.indexOf('分類'),
    sub: header.indexOf('子分類'),
    date: idx('日期'),
    out: idx('付款'),
    in: idx('收款'),
    note: idx('備註'),
    store: idx('商家')
  };
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');

  const records: ImportRecord[] = [];
  let skipped = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const category = cell(row, cols.category);
    const sub = cell(row, cols.sub);

    // 略過期初餘額 / 系統列
    if (category === 'SYSTEM' || sub === 'INIT_AMOUNT') {
      skipped += 1;
      continue;
    }

    const out = cell(row, cols.out);
    const inc = cell(row, cols.in);
    let type: ImportRecord['type'];
    if (out && !inc) type = 'expense';
    else if (inc && !out) type = 'income';
    else {
      // 兩邊都有＝轉帳；兩邊都空＝無法判斷 → 略過
      skipped += 1;
      continue;
    }

    const date = normalizeDate(cell(row, cols.date));
    const amount = amountOf(cell(row, cols.amount));
    if (!date || amount <= 0) {
      skipped += 1;
      continue;
    }

    const account = type === 'expense' ? out : inc;
    records.push({
      transaction_date: date,
      ledger_type: ledgerType,
      type,
      categoryName: category || sub || '其他',
      amount,
      currency: cell(row, cols.currency).toUpperCase() === 'USD' ? 'USD' : 'TWD',
      paymentMethod: inferPayment(account, sub),
      note: [cell(row, cols.note), cell(row, cols.store)].filter(Boolean).join(' ')
    });
  }

  return { records, skipped };
}
