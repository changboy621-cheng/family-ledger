import type { Currency } from '../types';

export interface PaidTotal {
  owner_id: string;
  currency: string;
  total: number;
}

export interface SettlementRecord {
  id: string;
  from_member: string;
  to_member: string;
  amount: number;
  currency: Currency;
  settled_on: string;
  note?: string | null;
  created_by?: string | null;
}

export interface MemberBalance {
  memberId: string;
  /** 先付的家庭支出 */
  paid: number;
  /** 應分擔（總額平均） */
  share: number;
  /** 正數 = 別人該補他；負數 = 他該補別人（已扣掉結清紀錄）。 */
  net: number;
}

export interface SettlementPlan {
  total: number;
  members: MemberBalance[];
  /** 最少筆數的補錢方式：from 付給 to。 */
  transfers: { from: string; to: string; amount: number }[];
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * 家庭支出平均分擔：每人應付 = 總額 ÷ 人數；差額 = 已付 − 應付。
 * 結清紀錄（A 付給 B）讓 A 的差額增加、B 的差額減少。
 * 新台幣以整數元計，差額小於 1 元視為已結清。
 */
export function computeSettlement(
  memberIds: string[],
  paid: PaidTotal[],
  settlements: SettlementRecord[],
  currency: Currency
): SettlementPlan {
  const tolerance = currency === 'TWD' ? 1 : 0.01;
  const paidBy = new Map(memberIds.map((id) => [id, 0]));
  for (const row of paid) {
    if (row.currency !== currency || !paidBy.has(row.owner_id)) continue;
    paidBy.set(row.owner_id, round((paidBy.get(row.owner_id) ?? 0) + Number(row.total)));
  }
  const total = round([...paidBy.values()].reduce((sum, value) => sum + value, 0));
  const share = memberIds.length > 0 ? total / memberIds.length : 0;

  const members = memberIds.map((memberId) => {
    let net = (paidBy.get(memberId) ?? 0) - share;
    for (const record of settlements) {
      if (record.currency !== currency) continue;
      if (record.from_member === memberId) net += Number(record.amount);
      if (record.to_member === memberId) net -= Number(record.amount);
    }
    return { memberId, paid: paidBy.get(memberId) ?? 0, share: round(share), net: round(net) };
  });

  // 貪婪配對：欠最多的先付給被欠最多的。
  const debtors = members.filter((m) => m.net < -tolerance).map((m) => ({ id: m.memberId, left: -m.net }));
  const creditors = members.filter((m) => m.net > tolerance).map((m) => ({ id: m.memberId, left: m.net }));
  debtors.sort((a, b) => b.left - a.left);
  creditors.sort((a, b) => b.left - a.left);
  const transfers: SettlementPlan['transfers'] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    const rounded = currency === 'TWD' ? Math.round(amount) : round(amount);
    if (rounded > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: rounded });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left <= tolerance) i += 1;
    if (creditors[j].left <= tolerance) j += 1;
  }

  return { total, members, transfers };
}

/** 未設定起算日時，預設本月 1 號。 */
export function defaultSplitSince(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}
