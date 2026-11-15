import { describe, expect, it } from 'vitest';
import type { Account } from '../types';
import { computeBalances, netWorthByCurrency, netWorthSeries, paymentMethodForKind, recentMonths } from './accounts';

const account = (id: string, opening: number, extra: Partial<Account> = {}): Account => ({
  id,
  family_id: 'f',
  owner_id: null,
  name: id,
  kind: 'bank',
  currency: 'TWD',
  opening_balance: opening,
  sort_order: 0,
  archived: false,
  ...extra
});

describe('accounts', () => {
  const accounts = [account('bank', 10000), account('card', 0, { kind: 'credit' }), account('usd', 100, { currency: 'USD' })];
  const flows = [
    { account_id: 'bank', month: '2026-09', net: -2000 },
    { account_id: 'card', month: '2026-10', net: -3000 },
    { account_id: 'bank', month: '2026-11', net: -3000 },
    { account_id: 'card', month: '2026-11', net: 3000 },
    { account_id: 'usd', month: '2026-11', net: 50.5 },
    { account_id: 'unknown', month: '2026-11', net: 999 }
  ];

  it('餘額 = 期初 + 流量，忽略看不到的帳戶', () => {
    const balances = computeBalances(accounts, flows);
    expect(balances.get('bank')).toBe(5000);
    expect(balances.get('card')).toBe(0);
    expect(balances.get('usd')).toBe(150.5);
    expect(balances.has('unknown')).toBe(false);
  });

  it('淨資產依幣別分開加總，信用卡負債會扣掉', () => {
    const balances = computeBalances(accounts, [{ account_id: 'card', month: '2026-11', net: -1200 }]);
    expect(netWorthByCurrency(accounts, balances)).toEqual({ TWD: 8800, USD: 100 });
  });

  it('淨資產走勢依月份累計', () => {
    const series = netWorthSeries(accounts, flows, ['2026-08', '2026-09', '2026-10', '2026-11'], 'TWD');
    expect(series.map((point) => point.value)).toEqual([10000, 8000, 5000, 5000]);
  });

  it('往前推月份會跨年', () => {
    expect(recentMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('帳戶種類推得付款方式', () => {
    expect(paymentMethodForKind('cash')).toBe('cash');
    expect(paymentMethodForKind('credit')).toBe('card');
  });
});
