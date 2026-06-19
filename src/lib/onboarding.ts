import type { Currency } from '../types';

export type OnboardingMode = 'create' | 'join';

export interface OnboardingDraft {
  mode: OnboardingMode;
  displayName: string;
  defaultCurrency: Currency;
  inviteCode?: string;
  email?: string;
  requiresEmailVerification?: boolean;
}

export type RegistrationStage = 'missing_user' | 'verified_session' | 'needs_email_verification';

export const onboardingDraftStorageKey = 'family-ledger:onboarding-draft';

export function resolveRegistrationStage(input: {
  hasUser: boolean;
  hasSession: boolean;
}): RegistrationStage {
  if (!input.hasUser) return 'missing_user';
  if (input.hasSession) return 'verified_session';
  return 'needs_email_verification';
}

export function saveOnboardingDraft(draft: OnboardingDraft) {
  localStorage.setItem(onboardingDraftStorageKey, JSON.stringify(draft));
}

export function loadOnboardingDraft(): OnboardingDraft | null {
  const raw = localStorage.getItem(onboardingDraftStorageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    localStorage.removeItem(onboardingDraftStorageKey);
    return null;
  }
}

export function clearOnboardingDraft() {
  localStorage.removeItem(onboardingDraftStorageKey);
}
