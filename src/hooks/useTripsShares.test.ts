import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { friendSharesPatch } from './useTrips';

const share = { id: 's', name: '阿明', amount: 100, repaid_at: null, repaid_method: null };

describe('friendSharesPatch', () => {
  it('沒有代墊、原本也沒有：不送欄位（未跑 013 migration 也能正常記帳）', () => {
    expect(friendSharesPatch({ friend_shares: [] })).toEqual({});
    expect(friendSharesPatch({})).toEqual({});
    expect(friendSharesPatch({ friend_shares: [] }, { friend_shares: [] })).toEqual({});
  });

  it('有代墊：送出', () => {
    expect(friendSharesPatch({ friend_shares: [share] })).toEqual({ friend_shares: [share] });
  });

  it('原本有代墊、這次全部移除：送出空陣列清掉', () => {
    expect(friendSharesPatch({ friend_shares: [] }, { friend_shares: [share] })).toEqual({ friend_shares: [] });
  });
});
