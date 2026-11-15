import { describe, expect, it } from 'vitest';
import { computeSettlement, defaultSplitSince } from './settlement';

describe('computeSettlement', () => {
  const members = ['me', 'her'];

  it('兩人各付一半：多付的人該被補差額的一半', () => {
    const plan = computeSettlement(
      members,
      [
        { owner_id: 'me', currency: 'TWD', total: 3000 },
        { owner_id: 'her', currency: 'TWD', total: 1000 }
      ],
      [],
      'TWD'
    );
    expect(plan.total).toBe(4000);
    expect(plan.members).toEqual([
      { memberId: 'me', paid: 3000, share: 2000, net: 1000 },
      { memberId: 'her', paid: 1000, share: 2000, net: -1000 }
    ]);
    expect(plan.transfers).toEqual([{ from: 'her', to: 'me', amount: 1000 }]);
  });

  it('結清紀錄會扣掉差額，結清後歸零', () => {
    const paid = [{ owner_id: 'me', currency: 'TWD', total: 3000 }];
    const settled = [{ id: 's1', from_member: 'her', to_member: 'me', amount: 1500, currency: 'TWD' as const, settled_on: '2026-11-30' }];
    const plan = computeSettlement(members, paid, settled, 'TWD');
    expect(plan.members.map((m) => m.net)).toEqual([0, 0]);
    expect(plan.transfers).toEqual([]);
  });

  it('部分結清：剩下的才需要補', () => {
    const paid = [{ owner_id: 'me', currency: 'TWD', total: 3000 }];
    const settled = [{ id: 's1', from_member: 'her', to_member: 'me', amount: 1000, currency: 'TWD' as const, settled_on: '2026-11-30' }];
    expect(computeSettlement(members, paid, settled, 'TWD').transfers).toEqual([{ from: 'her', to: 'me', amount: 500 }]);
  });

  it('不同幣別分開算，非成員的資料忽略', () => {
    const plan = computeSettlement(
      members,
      [
        { owner_id: 'me', currency: 'USD', total: 50 },
        { owner_id: 'ghost', currency: 'TWD', total: 999 }
      ],
      [],
      'TWD'
    );
    expect(plan.total).toBe(0);
    expect(plan.transfers).toEqual([]);
  });

  it('新台幣取整數、差 1 元內視為已結清', () => {
    const plan = computeSettlement(members, [{ owner_id: 'me', currency: 'TWD', total: 1001 }], [], 'TWD');
    expect(plan.transfers).toEqual([{ from: 'her', to: 'me', amount: 501 }]);
    expect(computeSettlement(members, [{ owner_id: 'me', currency: 'TWD', total: 1 }], [], 'TWD').transfers).toEqual([]);
  });

  it('三人時用最少筆數補錢', () => {
    const plan = computeSettlement(
      ['a', 'b', 'c'],
      [
        { owner_id: 'a', currency: 'TWD', total: 900 },
        { owner_id: 'b', currency: 'TWD', total: 0 },
        { owner_id: 'c', currency: 'TWD', total: 0 }
      ],
      [],
      'TWD'
    );
    expect(plan.transfers).toEqual([
      { from: 'b', to: 'a', amount: 300 },
      { from: 'c', to: 'a', amount: 300 }
    ]);
  });

  it('預設起算日為本月 1 號', () => {
    expect(defaultSplitSince(new Date(2026, 10, 15))).toBe('2026-11-01');
  });
});
