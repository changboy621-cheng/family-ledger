import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args), from: (...args: unknown[]) => from(...args) }
}));

import { createFamilyViaRpc, joinFamilyViaRpc } from './useAuth';

describe('joinFamilyViaRpc', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it('用正規化後的邀請碼與 profile 欄位呼叫 join_family_with_profile', async () => {
    rpc.mockResolvedValue({ data: [{ family_id: 'fam-1', family_name: '我們的家' }], error: null });
    const family = await joinFamilyViaRpc(' ab12cd ', { displayName: '小明', defaultCurrency: 'TWD' });
    expect(rpc).toHaveBeenCalledWith('join_family_with_profile', {
      p_code: 'AB12CD',
      p_display_name: '小明',
      p_avatar_color: expect.any(String),
      p_default_currency: 'TWD'
    });
    expect(family).toEqual({ id: 'fam-1', name: '我們的家' });
  });

  it('查無邀請碼（RPC 報錯）時丟出友善錯誤', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not found' } });
    await expect(joinFamilyViaRpc('ZZZZZZ', { displayName: '小明', defaultCurrency: 'TWD' })).rejects.toThrow(
      '找不到這組邀請碼'
    );
  });

  it('不再直接寫 user_profiles', async () => {
    rpc.mockResolvedValue({ data: [{ family_id: 'fam-1', family_name: '家' }], error: null });
    await joinFamilyViaRpc('AB12CD', { displayName: '小明', defaultCurrency: 'TWD' });
    expect(from).not.toHaveBeenCalled();
  });
});

describe('createFamilyViaRpc', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it('呼叫 create_family_with_profile 並回傳含邀請碼的家庭', async () => {
    const row = { id: 'fam-2', name: '我們的家', invite_code: 'XYZ234' };
    rpc.mockResolvedValue({ data: row, error: null });
    const family = await createFamilyViaRpc({ displayName: '小美', defaultCurrency: 'USD' });
    expect(rpc).toHaveBeenCalledWith('create_family_with_profile', {
      p_display_name: '小美',
      p_avatar_color: expect.any(String),
      p_default_currency: 'USD'
    });
    expect(family.invite_code).toBe('XYZ234');
    expect(from).not.toHaveBeenCalled();
  });

  it('RPC 失敗時把錯誤往上丟', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(createFamilyViaRpc({ displayName: '小美', defaultCurrency: 'TWD' })).rejects.toThrow('boom');
  });
});
