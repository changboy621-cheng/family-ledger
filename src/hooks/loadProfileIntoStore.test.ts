import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../store/authStore';

const { single, eq, select, from } = vi.hoisted(() => ({
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn()
}));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));

import { loadProfileIntoStore } from './loadProfileIntoStore';

describe('loadProfileIntoStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ profile: null, family: null });
    single.mockReset();
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ single });
  });

  it('讀到 profile 寫入 store', async () => {
    single.mockResolvedValueOnce({ data: { id: 'u1', family_id: null, display_name: '宇成' }, error: null });
    await loadProfileIntoStore('u1');
    expect(useAuthStore.getState().profile?.display_name).toBe('宇成');
  });

  it('profile 錯誤時清空 profile 與 family', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } });
    await loadProfileIntoStore('u1');
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().family).toBeNull();
  });
});
