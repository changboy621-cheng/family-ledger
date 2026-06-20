// 交易匯出列／匯入解析：把交易轉成中文欄位 CSV 列，並把外部 CSV 依欄名辨識成可寫入的紀錄。
import type { Currency, LedgerType, PaymentMethod, Transaction, TransactionType } from '../types';

export const EXPORT_HEADER = ['日期', '帳本', '類型', '類別', '金額', '幣別', '付款方式', '備註', '記錄人'];

export interface ImportRecord {
  transaction_date: string;
  ledger_type: LedgerType;
  type: TransactionType;
  categoryName: string;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod | null;
  note: string;
}

function paymentLabel(method: PaymentMethod | null | undefined): string {
  if (method === 'cash') return '現金';
  if (method === 'card') return '刷卡';
  return '';
}

export function buildExportRows(transactions: Transaction[]): string[][] {
  return transactions.map((transaction) => [
    transaction.transaction_date,
    transaction.ledger_type === 'family' ? '家庭' : '個人',
    transaction.type === 'expense' ? '支出' : '收入',
    transaction.category?.name ?? '',
    String(transaction.amount),
    transaction.currency,
    paymentLabel(transaction.payment_method),
    transaction.note ?? '',
    transaction.owner?.display_name ?? ''
  ]);
}

const ALIASES: Record<string, string[]> = {
  date: ['日期', 'date'],
  ledger: ['帳本', 'ledger'],
  type: ['類型', 'type'],
  category: ['類別', '分類', 'category'],
  amount: ['金額', '價格', 'amount'],
  currency: ['幣別', 'currency'],
  payment: ['付款方式', '付款', 'payment'],
  note: ['備註', '說明', 'note']
};

function parsePayment(raw: string): PaymentMethod | null {
  const value = raw.trim().toLowerCase();
  if (value.includes('刷') || value.includes('card') || value.includes('信用')) return 'card';
  if (value.includes('現金') || value.includes('cash')) return 'cash';
  return null;
}

function detectColumns(header: string[]): Record<string, number> {
  const columns: Record<string, number> = {};
  header.forEach((cell, index) => {
    const norm = cell.trim().toLowerCase();
    for (const [field, names] of Object.entries(ALIASES)) {
      if (names.some((name) => name.toLowerCase() === norm)) columns[field] = index;
    }
  });
  return columns;
}

function pick(row: string[], index: number | undefined): string {
  return index === undefined ? '' : (row[index] ?? '');
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function parseLedger(raw: string): LedgerType {
  const value = raw.trim().toLowerCase();
  return value.includes('個人') || value === 'personal' ? 'personal' : 'family';
}

function parseType(raw: string): TransactionType {
  const value = raw.trim().toLowerCase();
  return value.includes('收入') || value === 'income' ? 'income' : 'expense';
}

function parseCurrency(raw: string): Currency {
  const value = raw.trim().toLowerCase();
  return value.includes('usd') || value.includes('美') ? 'USD' : 'TWD';
}

function isValidDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

export function parseImportRecords(rows: string[][]): { records: ImportRecord[]; skipped: number } {
  if (rows.length < 2) return { records: [], skipped: 0 };

  const [header, ...data] = rows;
  const columns = detectColumns(header);
  const records: ImportRecord[] = [];
  let skipped = 0;

  for (const row of data) {
    const date = pick(row, columns.date).trim();
    const amount = parseAmount(pick(row, columns.amount));
    const categoryName = pick(row, columns.category).trim();

    if (!isValidDate(date) || amount <= 0 || !categoryName) {
      skipped += 1;
      continue;
    }

    records.push({
      transaction_date: date,
      ledger_type: parseLedger(pick(row, columns.ledger)),
      type: parseType(pick(row, columns.type)),
      categoryName,
      amount,
      currency: parseCurrency(pick(row, columns.currency)),
      paymentMethod: parsePayment(pick(row, columns.payment)),
      note: pick(row, columns.note).trim()
    });
  }

  return { records, skipped };
}
