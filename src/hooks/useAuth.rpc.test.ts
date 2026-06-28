import { describe, expect, it, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) }
}));

// 只測 join 分支對 RPC 的呼叫契約（純函式抽出版本）
import { resolveInviteFamily } from './useAuth';

describe('resolveInviteFamily', () => {
  beforeEach(() => rpc.mockReset());

  it('用正規化後的邀請碼呼叫 find_family_by_invite', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'fam-1', name: '我們的家' }], error: null });
    const family = await resolveInviteFamily(' ab12cd ');
    expect(rpc).toHaveBeenCalledWith('find_family_by_invite', { code: 'AB12CD' });
    expect(family).toEqual({ id: 'fam-1', name: '我們的家' });
  });

  it('查無邀請碼時丟出友善錯誤', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(resolveInviteFamily('ZZZZZZ')).rejects.toThrow('找不到這組邀請碼');
  });
});
