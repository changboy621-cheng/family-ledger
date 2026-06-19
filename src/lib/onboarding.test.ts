import { describe, expect, it } from 'vitest';
import { resolveRegistrationStage } from './onboarding';

describe('resolveRegistrationStage', () => {
  it('returns needs_email_verification when user exists but session is missing', () => {
    expect(resolveRegistrationStage({ hasUser: true, hasSession: false })).toBe('needs_email_verification');
  });

  it('returns verified_session when both user and session exist', () => {
    expect(resolveRegistrationStage({ hasUser: true, hasSession: true })).toBe('verified_session');
  });

  it('returns missing_user when signup did not create a user', () => {
    expect(resolveRegistrationStage({ hasUser: false, hasSession: false })).toBe('missing_user');
  });
});
