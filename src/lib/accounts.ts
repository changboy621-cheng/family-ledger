import type { Account, AccountKind, AccountMonthlyFlow, Currency, PaymentMethod } from '../types';

export const ACCOUNT_KINDS: { value: AccountKind; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'bank', label: '銀行' },
  { value: 'credit', label: '信用卡' },
  { value: 'other', label: '其他' }
];

export function accountKindLabel(kind: AccountKind): string {
  return ACCOUNT_KINDS.find((item) => item.value === kind)?.label ?? '其他';
}

/** 選了帳戶時，舊有的「現金／刷卡」由帳戶種類推得，讓付款方式分析照常運作。 */
export function paymentMethodForKind(kind: AccountKind): PaymentMethod {
  return kind === 'cash' ? 'cash' : 'card';
}

/** 每個帳戶目前餘額 = 期初金額 + 所有月份淨流量。 */
export function computeBalances(accounts: Account[], flows: AccountMonthlyFlow[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const account of accounts) balances.set(account.id, Number(account.opening_balance) || 0);
  for (const flow of flows) {
    if (!balances.has(flow.account_id)) continue;
    balances.set(flow.account_id, roundMoney((balances.get(flow.account_id) ?? 0) + flow.net));
  }
  return balances;
}

/** 依幣別加總淨資產（信用卡負餘額即負債，自然扣掉）。封存的帳戶仍計入，因為錢還在。 */
export function netWorthByCurrency(accounts: Account[], balances: Map<string, number>): Record<Currency, number> {
  const totals: Record<Currency, number> = { TWD: 0, USD: 0 };
  for (const account of accounts) totals[account.currency] = roundMoney(totals[account.currency] + (balances.get(account.id) ?? 0));
  return totals;
}

/** 以 YYYY-MM 為單位往前推 n 個月（含當月），由舊到新。 */
export function recentMonths(endMonth: string, count: number): string[] {
  const [year, month] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, month - 1 - offset, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/**
 * 淨資產走勢：每個月月底的淨資產（某幣別）。
 * 期初金額視為最早就存在；每個月 = 期初 + 該月（含）以前所有流量。
 */
export function netWorthSeries(
  accounts: Account[],
  flows: AccountMonthlyFlow[],
  months: string[],
  currency: Currency
): { month: string; value: number }[] {
  const ids = new Set(accounts.filter((account) => account.currency === currency).map((account) => account.id));
  const opening = accounts
    .filter((account) => ids.has(account.id))
    .reduce((sum, account) => sum + (Number(account.opening_balance) || 0), 0);
  const relevant = flows.filter((flow) => ids.has(flow.account_id));
  return months.map((month) => ({
    month,
    value: roundMoney(opening + relevant.filter((flow) => flow.month <= month).reduce((sum, flow) => sum + flow.net, 0))
  }));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
