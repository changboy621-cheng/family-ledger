import { describe, expect, it } from 'vitest';
import {
  cashOnHand,
  equalSplitTransfer,
  settleByMember,
  settleByCategory,
  expensesInCategory,
  friendDebts,
  guessTripCategory,
  pickTripForDate,
  knownFriendNames,
  ownAmount,
  ownTwd,
  setShareRepaid,
  type FriendShare,
  defaultExpenseDate,
  formatRate,
  formatTripAmount,
  parseRate,
  parseTripAmount,
  summarizeTrip,
  toTwd,
  tripCategory,
  tripDays,
  tripExpensesToCsv,
  tripStatus,
  type Trip,
  type TripCashExchange,
  type TripExpense
} from './trips';
import { parseTripCashExchanges, parseTripExpenses, parseTrips } from './schemas';

const trip: Trip = {
  id: 't1',
  family_id: 'f1',
  name: '東京',
  start_date: '2026-11-01',
  end_date: '2026-11-05',
  local_currency: 'JPY',
  rate: 0.21,
  budget_twd: 10000
};

function expense(overrides: Partial<TripExpense>): TripExpense {
  return {
    id: 'e',
    trip_id: 't1',
    family_id: 'f1',
    expense_date: '2026-11-01',
    amount: 1000,
    currency: 'JPY',
    rate: 0.21,
    category: 'food',
    ...overrides
  };
}

describe('金額與匯率', () => {
  it('依幣別小數位取整，並支援算式', () => {
    expect(parseTripAmount('1200+380', 'JPY')).toBe(1580);
    expect(parseTripAmount('10.567', 'JPY')).toBe(11);
    expect(parseTripAmount('10.567', 'USD')).toBe(10.57);
    expect(parseTripAmount('', 'JPY')).toBe(0);
    expect(parseTripAmount('5-10', 'JPY')).toBe(0);
  });

  it('匯率需為正數', () => {
    expect(parseRate('0.215')).toBe(0.215);
    expect(parseRate('0')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parseRate('')).toBeNull();
  });

  it('折合新台幣四捨五入', () => {
    expect(toTwd({ amount: 1000, rate: 0.215 })).toBe(215);
    expect(toTwd({ amount: 333, rate: 0.215 })).toBe(72);
  });

  it('格式化金額與匯率', () => {
    expect(formatTripAmount(1580, 'JPY')).toBe('JPY 1,580');
    expect(formatTripAmount(12.5, 'USD')).toBe('USD 12.50');
    expect(formatRate(0.2154321)).toBe('0.215');
    expect(formatRate(0.0012)).toBe('0.0012');
    expect(formatRate(31.5)).toBe('31.5');
  });
});

describe('日期', () => {
  it('旅行天數含頭尾', () => {
    expect(tripDays('2026-11-01', '2026-11-05')).toBe(5);
    expect(tripDays('2026-11-01', '2026-11-01')).toBe(1);
    expect(tripDays('2026-12-30', '2027-01-02')).toBe(4);
  });

  it('預設記帳日落在旅行期間內', () => {
    expect(defaultExpenseDate(trip, '2026-11-03')).toBe('2026-11-03');
    expect(defaultExpenseDate(trip, '2026-10-12')).toBe('2026-11-01');
    expect(defaultExpenseDate(trip, '2026-12-01')).toBe('2026-11-05');
  });

  it('旅行狀態', () => {
    expect(tripStatus(trip, '2026-10-31')).toBe('upcoming');
    expect(tripStatus(trip, '2026-11-01')).toBe('ongoing');
    expect(tripStatus(trip, '2026-11-05')).toBe('ongoing');
    expect(tripStatus(trip, '2026-11-06')).toBe('past');
  });
});

describe('summarizeTrip', () => {
  it('彙總總額、分類、每日、幣別與預算', () => {
    const summary = summarizeTrip(trip, [
      expense({ id: '1', amount: 10000, category: 'food' }),
      expense({ id: '2', amount: 20000, category: 'shopping', expense_date: '2026-11-02' }),
      expense({ id: '3', amount: 10, currency: 'USD', rate: 31, category: 'food', expense_date: '2026-11-02' })
    ]);

    // 2100 + 4200 + 310
    expect(summary.totalTwd).toBe(6610);
    expect(summary.count).toBe(3);
    expect(summary.days).toBe(5);
    expect(summary.perDayTwd).toBe(1322);
    expect(summary.byCategory.map((item) => [item.category.key, item.twd])).toEqual([
      ['shopping', 4200],
      ['food', 2410]
    ]);
    expect(summary.byDay.map((item) => [item.date, item.twd])).toEqual([
      ['2026-11-01', 2100],
      ['2026-11-02', 4510]
    ]);
    expect(summary.byCurrency.map((item) => item.currency)).toEqual(['JPY', 'USD']);
    expect(summary.budgetUsed).toBeCloseTo(0.661);
    expect(summary.budgetLeftTwd).toBe(3390);
  });

  it('沒有花費與沒有預算時的邊界', () => {
    const summary = summarizeTrip({ ...trip, budget_twd: null }, []);
    expect(summary.totalTwd).toBe(0);
    expect(summary.perDayTwd).toBe(0);
    expect(summary.byCategory).toEqual([]);
    expect(summary.budgetUsed).toBeNull();
    expect(summary.budgetLeftTwd).toBeNull();
  });

  it('超支時剩餘為負', () => {
    const summary = summarizeTrip(trip, [expense({ amount: 100000 })]);
    expect(summary.budgetLeftTwd).toBe(-11000);
  });
});

describe('其他', () => {
  it('未知分類退回「其他」', () => {
    expect(tripCategory('nope').key).toBe('other');
  });

  it('CSV 會跳脫逗號與引號', () => {
    const csv = tripExpensesToCsv([expense({ note: 'a,"b"', paid_by: 'u1', payment_method: 'card' })], () => '小明');
    const [header, row] = csv.split('\n');
    expect(header).toContain('折合新台幣');
    expect(row).toBe('2026-11-01,餐飲,1000,JPY,0.21,210,1000,,刷卡,小明,"a,""b"""');
  });

  it('schema 把字串數字轉成數字，並丟棄壞列', () => {
    const trips = parseTrips([
      { id: 'a', family_id: 'f', name: 'x', start_date: '2026-11-01', end_date: '2026-11-02', local_currency: 'JPY', rate: '0.21', budget_twd: '5000.00' },
      { id: 'bad', family_id: 'f', name: 'x', start_date: 'oops', end_date: '2026-11-02', local_currency: 'JPY', rate: 1 }
    ]);
    expect(trips).toHaveLength(1);
    expect(trips[0].rate).toBe(0.21);
    expect(trips[0].budget_twd).toBe(5000);

    const expenses = parseTripExpenses([
      { id: 'e', trip_id: 't', family_id: 'f', expense_date: '2026-11-01', amount: '1200.00', currency: 'JPY', rate: '0.21', category: null }
    ]);
    expect(expenses[0].amount).toBe(1200);
    expect(expenses[0].category).toBe('other');
  });
});

describe('手邊現金', () => {
  function exchange(overrides: Partial<TripCashExchange>): TripCashExchange {
    return {
      id: 'x',
      trip_id: 't1',
      family_id: 'f1',
      exchange_date: '2026-10-30',
      currency: 'JPY',
      amount: 50000,
      rate: 0.21,
      ...overrides
    };
  }

  it('換匯合計扣掉該幣別的現金花費，刷卡與其他幣別不扣', () => {
    const result = cashOnHand(
      [exchange({ amount: 50000 }), exchange({ amount: 30000, rate: 0.2 })],
      [
        expense({ amount: 1200, payment_method: 'cash' }),
        expense({ amount: 800, payment_method: 'cash' }),
        expense({ amount: 5000, payment_method: 'card' }),
        expense({ amount: 300, payment_method: null }),
        expense({ amount: 20, currency: 'USD', payment_method: 'cash' })
      ]
    );
    expect(result).toEqual([{ currency: 'JPY', exchanged: 80000, received: 0, spent: 2000, remaining: 78000, costTwd: 16500 }]);
  });

  it('多幣別依換匯成本排序，並依小數位消除浮點誤差', () => {
    const result = cashOnHand(
      [exchange({ amount: 10000 }), exchange({ currency: 'USD', amount: 100, rate: 31 })],
      [expense({ currency: 'USD', amount: 0.1, payment_method: 'cash' }), expense({ currency: 'USD', amount: 0.2, payment_method: 'cash' })]
    );
    expect(result.map((item) => item.currency)).toEqual(['USD', 'JPY']);
    expect(result[0]).toMatchObject({ spent: 0.3, remaining: 99.7 });
  });

  it('現金花費多於換匯時剩餘為負；沒有換匯紀錄則為空', () => {
    expect(cashOnHand([exchange({ amount: 1000 })], [expense({ amount: 1500, payment_method: 'cash' })])[0].remaining).toBe(-500);
    expect(cashOnHand([], [expense({ payment_method: 'cash' })])).toEqual([]);
  });

  it('解析換匯資料列，丟棄金額無效者', () => {
    const rows = parseTripCashExchanges([
      { ...exchange({}), amount: '50000', rate: '0.21', exchange_date: '2026-10-30T00:00:00' },
      { ...exchange({ id: 'bad' }), amount: 0 }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 50000, rate: 0.21, exchange_date: '2026-10-30' });
  });
});

describe('幫朋友代墊', () => {
  function share(overrides: Partial<FriendShare>): FriendShare {
    return { id: 's', name: '阿明', amount: 1000, repaid_at: null, repaid_method: null, ...overrides };
  }

  const dinner = expense({
    id: 'dinner',
    amount: 3000,
    payment_method: 'cash',
    friend_shares: [share({ id: 's1', amount: 1000 }), share({ id: 's2', name: '小華', amount: 500 })]
  });

  it('自付 = 花費 − 代墊，不會小於 0', () => {
    expect(ownAmount(dinner)).toBe(1500);
    expect(ownTwd(dinner)).toBe(315);
    expect(ownAmount(expense({ amount: 100, friend_shares: [share({ amount: 300 })] }))).toBe(0);
    expect(ownAmount(expense({ amount: 100 }))).toBe(100);
  });

  it('旅行總花費、分類、幣別只算自付；全額代墊的那筆不列入', () => {
    const forFriend = expense({ id: 'gift', category: 'souvenir', amount: 2000, friend_shares: [share({ amount: 2000 })] });
    const summary = summarizeTrip(trip, [dinner, forFriend]);
    expect(summary.totalTwd).toBe(315);
    expect(summary.byCategory.map((item) => item.category.key)).toEqual(['food']);
    expect(summary.byCurrency).toEqual([{ currency: 'JPY', amount: 1500, twd: 315 }]);
  });

  it('依朋友彙總未還與已還，未還多的排前面', () => {
    const repaid = expense({
      id: 'taxi',
      amount: 2000,
      friend_shares: [share({ id: 's3', amount: 800, repaid_at: '2026-11-03', repaid_method: 'transfer' })]
    });
    const usd = expense({ id: 'usd', currency: 'USD', rate: 31, amount: 30, friend_shares: [share({ id: 's4', amount: 10 })] });
    const debts = friendDebts([dinner, repaid, usd]);

    expect(debts.map((debt) => debt.name)).toEqual(['阿明', '小華']);
    expect(debts[0].outstandingTwd).toBe(210 + 310);
    expect(debts[0].outstandingByCurrency).toEqual([
      { currency: 'JPY', amount: 1000 },
      { currency: 'USD', amount: 10 }
    ]);
    expect(debts[0].repaidTwd).toBe(168);
    expect(debts[0].repaid.map((item) => item.share.id)).toEqual(['s3']);
  });

  it('名字前後空白視為同一人；空白名字略過', () => {
    const debts = friendDebts([
      expense({ friend_shares: [share({ name: ' 阿明 ' }), share({ id: 'x', name: '  ' })] }),
      expense({ friend_shares: [share({ name: '阿明' })] })
    ]);
    expect(debts).toHaveLength(1);
    expect(debts[0].outstanding).toHaveLength(2);
  });

  it('朋友用現金還的錢加回手邊現金；轉帳與未還不影響', () => {
    const exchange: TripCashExchange = {
      id: 'x',
      trip_id: 't1',
      family_id: 'f1',
      exchange_date: '2026-10-30',
      currency: 'JPY',
      amount: 10000,
      rate: 0.21
    };
    const paid = expense({
      amount: 3000,
      payment_method: 'cash',
      friend_shares: [
        share({ id: 'a', amount: 1000, repaid_at: '2026-11-02', repaid_method: 'cash' }),
        share({ id: 'b', amount: 500, repaid_at: '2026-11-02', repaid_method: 'transfer' }),
        share({ id: 'c', amount: 700 })
      ]
    });
    expect(cashOnHand([exchange], [paid])[0]).toMatchObject({ exchanged: 10000, received: 1000, spent: 3000, remaining: 8000 });
  });

  it('標成已還／改回未還只動那一筆', () => {
    const shares = [share({ id: 's1' }), share({ id: 's2' })];
    const repaid = setShareRepaid(shares, 's1', { date: '2026-11-04', method: 'cash' });
    expect(repaid[0]).toMatchObject({ repaid_at: '2026-11-04', repaid_method: 'cash' });
    expect(repaid[1].repaid_at).toBeNull();
    expect(setShareRepaid(repaid, 's1', null)[0]).toMatchObject({ repaid_at: null, repaid_method: null });
  });

  it('朋友名字最近用過的在前、不重複', () => {
    expect(knownFriendNames([dinner, expense({ friend_shares: [share({ name: '阿明' }), share({ name: '大雄' })] })])).toEqual([
      '阿明',
      '小華',
      '大雄'
    ]);
  });

  it('CSV 多出自付與代墊欄', () => {
    const csv = tripExpensesToCsv([dinner], () => '');
    expect(csv.split('\n')[0]).toContain('自付金額,代墊給朋友');
    expect(csv.split('\n')[1]).toContain('1500,阿明 1000、小華 500');
  });

  it('解析：沒有欄位時為空陣列；壞掉的代墊資料不讓整筆花費消失', () => {
    const base = { id: 'e', trip_id: 't', family_id: 'f', expense_date: '2026-11-01', amount: 100, currency: 'JPY', rate: 0.21 };
    expect(parseTripExpenses([base])[0].friend_shares).toEqual([]);
    expect(parseTripExpenses([{ ...base, friend_shares: 'oops' }])[0].friend_shares).toEqual([]);
    const [row] = parseTripExpenses([
      { ...base, friend_shares: [{ id: 's', name: '阿明', amount: '50', repaid_at: '2026-11-02', repaid_method: 'cash' }] }
    ]);
    expect(row.friend_shares).toEqual([{ id: 's', name: '阿明', amount: 50, repaid_at: '2026-11-02', repaid_method: 'cash' }]);
  });
});

describe('結算：誰出多少、刷卡現金分開', () => {
  const rows = [
    expense({ id: 'a', paid_by: 'mack', payment_method: 'card', amount: 10000 }),
    expense({ id: 'b', paid_by: 'mack', payment_method: 'cash', amount: 2000 }),
    expense({
      id: 'c',
      paid_by: 'mina',
      payment_method: 'cash',
      amount: 3000,
      friend_shares: [{ id: 's', name: '阿明', amount: 1000, repaid_at: null, repaid_method: null }]
    }),
    expense({ id: 'd', paid_by: 'mina', payment_method: null, amount: 500, currency: 'TWD', rate: 1 })
  ];

  it('依付款人分開刷卡、現金、未指定；扣掉代墊得到實際負擔', () => {
    const settlement = settleByMember(rows);
    expect(settlement.members).toEqual([
      { memberId: 'mack', cardTwd: 2100, cashTwd: 420, otherTwd: 0, paidTwd: 2520, friendTwd: 0, ownTwd: 2520 },
      { memberId: 'mina', cardTwd: 0, cashTwd: 630, otherTwd: 500, paidTwd: 1130, friendTwd: 210, ownTwd: 920 }
    ]);
    expect(settlement).toMatchObject({ cardTwd: 2100, cashTwd: 1050, otherTwd: 500, paidTwd: 3650, friendTwd: 210, ownTwd: 3440 });
  });

  it('實際負擔合計等於旅行總花費', () => {
    expect(settleByMember(rows).ownTwd).toBe(summarizeTrip(trip, rows).totalTwd);
  });

  it('兩人平分：負擔少的補差額的一半給負擔多的', () => {
    const { members } = settleByMember(rows);
    expect(equalSplitTransfer(members, ['mack', 'mina'])).toEqual({ from: 'mina', to: 'mack', twd: 800 });
  });

  it('只有一人付過錢也能算；差額為 0、成員不是兩位、或有沒記付款人的花費時不算', () => {
    const solo = settleByMember([expense({ paid_by: 'mack', amount: 1000 })]).members;
    expect(equalSplitTransfer(solo, ['mack', 'mina'])).toEqual({ from: 'mina', to: 'mack', twd: 105 });
    const even = settleByMember([expense({ paid_by: 'mack' }), expense({ id: 'x', paid_by: 'mina' })]).members;
    expect(equalSplitTransfer(even, ['mack', 'mina'])).toBeNull();
    expect(equalSplitTransfer(solo, ['mack'])).toBeNull();
    const unknown = settleByMember([expense({ paid_by: null })]).members;
    expect(equalSplitTransfer(unknown, ['mack', 'mina'])).toBeNull();
  });
});

describe('結算：分類加總', () => {
  const rows = [
    expense({ id: 'a', category: 'food', paid_by: 'mack', payment_method: 'card', amount: 10000 }),
    expense({
      id: 'b',
      category: 'food',
      paid_by: 'mina',
      payment_method: 'cash',
      amount: 3000,
      friend_shares: [{ id: 's', name: '阿明', amount: 1000, repaid_at: null, repaid_method: null }]
    }),
    expense({ id: 'c', category: 'transport', paid_by: 'mina', payment_method: null, amount: 1000 }),
    expense({ id: 'd', category: 'souvenir', paid_by: 'mack', amount: 500, friend_shares: [{ id: 't', name: '阿明', amount: 500, repaid_at: null, repaid_method: null }] }),
    expense({ id: 'e', category: 'mystery', paid_by: null, payment_method: 'card', amount: 100 })
  ];

  it('每個分類：實際花費、誰付的、刷卡現金分開；扣掉代墊；全額代墊的分類不列', () => {
    const result = settleByCategory(rows);
    expect(result.map((row) => row.category.key)).toEqual(['food', 'transport', 'other']);
    expect(result[0]).toMatchObject({
      ownTwd: 2520,
      byMember: [
        { memberId: 'mack', twd: 2100 },
        { memberId: 'mina', twd: 420 }
      ],
      cardTwd: 2100,
      cashTwd: 420,
      otherTwd: 0
    });
    expect(result[1]).toMatchObject({ ownTwd: 210, otherTwd: 210 });
    expect(result[2].byMember).toEqual([{ memberId: null, twd: 21 }]);
  });

  it('分類加總等於這趟實際花費', () => {
    const total = settleByCategory(rows).reduce((sum, row) => sum + row.ownTwd, 0);
    expect(total).toBe(settleByMember(rows).ownTwd);
  });
});

describe('expensesInCategory', () => {
  it('只列該分類且有自付金額的花費；未知分類歸到其他', () => {
    const rows = [
      expense({ id: 'a', category: 'food' }),
      expense({ id: 'b', category: 'transport' }),
      expense({ id: 'c', category: 'food', amount: 100, friend_shares: [{ id: 's', name: '阿明', amount: 100, repaid_at: null, repaid_method: null }] }),
      expense({ id: 'd', category: 'mystery' })
    ];
    expect(expensesInCategory(rows, 'food').map((row) => row.id)).toEqual(['a']);
    expect(expensesInCategory(rows, 'other').map((row) => row.id)).toEqual(['d']);
  });
});

describe('guessTripCategory', () => {
  it('依日常分類名稱對應旅行分類', () => {
    expect(guessTripCategory('餐飲食品')).toBe('food');
    expect(guessTripCategory('飲料')).toBe('snack');
    expect(guessTripCategory('交通')).toBe('transport');
    expect(guessTripCategory('伴手禮')).toBe('souvenir');
    expect(guessTripCategory('醫療')).toBe('other');
    expect(guessTripCategory(null)).toBe('other');
  });
});

describe('pickTripForDate', () => {
  const trips = [
    { id: 'new', start_date: '2026-11-01', end_date: '2026-11-05' },
    { id: 'oita', start_date: '2026-10-18', end_date: '2026-10-22' }
  ];
  it('選日期落在期間內的旅行', () => {
    expect(pickTripForDate(trips, '2026-10-20')?.id).toBe('oita');
    expect(pickTripForDate(trips, '2026-10-22')?.id).toBe('oita');
  });
  it('都不在期間內時選最近的一趟；沒有旅行回傳 null', () => {
    expect(pickTripForDate(trips, '2026-09-01')?.id).toBe('new');
    expect(pickTripForDate([], '2026-09-01')).toBeNull();
  });
});
