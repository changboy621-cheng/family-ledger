import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('translates known Supabase auth messages', () => {
    expect(getErrorMessage(new Error('Email signups are disabled'))).toContain('Email 註冊');
  });

  it('reads plain object errors from database responses', () => {
    expect(getErrorMessage({ message: 'row-level security policy for table "families"' })).toContain(
      '資料庫安全規則'
    );
  });

  it('translates missing table grants into a setup hint', () => {
    expect(
      getErrorMessage({
        message:
          'permission denied for table families Grant the required privileges to the current role with: GRANT SELECT, INSERT ON public.families TO authenticated;'
      })
    ).toContain('資料表權限');
  });

  it('translates duplicate user profile constraint into a relogin hint', () => {
    expect(
      getErrorMessage({
        message: 'duplicate key value violates unique constraint "user_profiles_pkey"'
      })
    ).toContain('重新登入');
  });
});
