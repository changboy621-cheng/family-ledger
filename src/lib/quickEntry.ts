// 解析 Siri 捷徑口述的一句話，例如「200 餐飲 午餐」→ 可記帳的結構。
import type { LedgerType, PaymentMethod, TransactionType } from '../types';

export interface QuickEntry {
  amount: number;
  type: TransactionType;
  ledgerType: LedgerType;
  paymentMethod: PaymentMethod | null;
  categoryName: string | null;
  note: string;
}

export function parseQuickEntry(rawText: string, categoryNames: string[]): QuickEntry | null {
  const text = rawText.trim();
  if (!text) return null;

  const amountMatch = text.match(/\d[\d,]*(\.\d+)?/);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[0].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let rest = text.replace(amountMatch[0], ' ');

  let type: TransactionType = 'expense';
  if (/收入|income/i.test(rest)) {
    type = 'income';
    rest = rest.replace(/收入|income/i, ' ');
  } else if (/支出|expense/i.test(rest)) {
    rest = rest.replace(/支出|expense/i, ' ');
  }

  let ledgerType: LedgerType = 'family';
  if (/個人|personal/i.test(rest)) {
    ledgerType = 'personal';
    rest = rest.replace(/個人|personal/i, ' ');
  } else if (/家庭|family/i.test(rest)) {
    rest = rest.replace(/家庭|family/i, ' ');
  }

  let paymentMethod: PaymentMethod | null = null;
  if (/刷卡|信用卡|card/i.test(rest)) {
    paymentMethod = 'card';
    rest = rest.replace(/刷卡|信用卡|card/i, ' ');
  } else if (/現金|cash/i.test(rest)) {
    paymentMethod = 'cash';
    rest = rest.replace(/現金|cash/i, ' ');
  }

  // 以「最長且為子字串」的類別名稱比對，避免短名稱誤判
  let categoryName: string | null = null;
  const sorted = [...categoryNames].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (rest.includes(name)) {
      categoryName = name;
      rest = rest.replace(name, ' ');
      break;
    }
  }

  const note = rest.replace(/\s+/g, ' ').trim();
  return { amount, type, ledgerType, paymentMethod, categoryName, note };
}
