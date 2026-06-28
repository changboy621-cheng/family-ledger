import { useCallback } from 'react';
import type { Currency } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { loadProfileIntoStore } from './loadProfileIntoStore';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  resolveRegistrationStage,
  saveOnboardingDraft,
  type OnboardingMode
} from '../lib/onboarding';
import { normalizeDisplayName } from '../lib/profile';

const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#15803D', '#B45309', '#EF4444'];

function createInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function pickAvatarColor(seed: string) {
  const index = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

async function createFamilyWithRetry() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await supabase
      .from('families')
      .insert({ name: '我們的家', invite_code: createInviteCode() })
      .select()
      .single();

    if (!response.error) return response.data;
    if (!response.error.message.includes('duplicate key value violates unique constraint')) {
      throw response.error;
    }
  }

  throw new Error('邀請碼產生失敗，請再試一次。');
}

// 用邀請碼解析家庭：改走 SECURITY DEFINER 的 find_family_by_invite RPC，
// 避免前端直接 select families 整表（否則 invite_code 可被列舉）。
export async function resolveInviteFamily(rawCode: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.rpc('find_family_by_invite', {
    code: rawCode?.trim().toUpperCase() ?? ''
  });
  const match = Array.isArray(data) ? data[0] : data;
  if (error || !match) {
    throw new Error('找不到這組邀請碼，請確認大小寫與數字。');
  }
  return match as { id: string; name: string };
}

export function useAuth() {
  const { session, profile, family, loading, reset } = useAuthStore();

  const createFamilyAndProfile = useCallback(
    async ({
      userId,
      mode,
      displayName,
      defaultCurrency,
      inviteCode
    }: {
      userId: string;
      mode: OnboardingMode;
      displayName: string;
      defaultCurrency: Currency;
      inviteCode?: string;
    }) => {
      let familyId = '';
      let familyData = null;

      if (mode === 'create') {
        familyData = await createFamilyWithRetry();
        familyId = familyData.id;
      } else {
        familyData = await resolveInviteFamily(inviteCode ?? '');
        familyId = familyData.id;
      }

      const { error: profileError } = await supabase.from('user_profiles').upsert(
        {
          id: userId,
          family_id: familyId,
          display_name: displayName,
          avatar_color: pickAvatarColor(displayName),
          default_currency: defaultCurrency
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      await loadProfileIntoStore(userId);
      clearOnboardingDraft();
      return familyData;
    },
    []
  );

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
  }

  async function registerFamily(email: string, password: string, displayName: string, defaultCurrency: Currency) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const stage = resolveRegistrationStage({
      hasUser: Boolean(data.user),
      hasSession: Boolean(data.session)
    });

    if (stage === 'missing_user' || !data.user) {
      throw new Error('註冊未完成，請稍後再試一次。');
    }

    saveOnboardingDraft({
      mode: 'create',
      email,
      displayName,
      defaultCurrency,
      requiresEmailVerification: stage === 'needs_email_verification'
    });

    if (stage === 'needs_email_verification') {
      return { status: 'pending_verification' as const };
    }

    const family = await createFamilyAndProfile({
      userId: data.user.id,
      mode: 'create',
      displayName,
      defaultCurrency
    });

    return { status: 'completed' as const, family };
  }

  async function joinFamily(email: string, password: string, displayName: string, defaultCurrency: Currency, inviteCode: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const stage = resolveRegistrationStage({
      hasUser: Boolean(data.user),
      hasSession: Boolean(data.session)
    });

    if (stage === 'missing_user' || !data.user) {
      throw new Error('加入家庭未完成，請稍後再試一次。');
    }

    saveOnboardingDraft({
      mode: 'join',
      email,
      displayName,
      defaultCurrency,
      inviteCode: inviteCode.trim().toUpperCase(),
      requiresEmailVerification: stage === 'needs_email_verification'
    });

    if (stage === 'needs_email_verification') {
      return { status: 'pending_verification' as const };
    }

    const family = await createFamilyAndProfile({
      userId: data.user.id,
      mode: 'join',
      displayName,
      defaultCurrency,
      inviteCode
    });

    return { status: 'completed' as const, family };
  }

  async function completeOnboarding(input: {
    mode: OnboardingMode;
    displayName: string;
    defaultCurrency: Currency;
    inviteCode?: string;
  }) {
    if (!session?.user.id) {
      throw new Error('請先登入，才能完成家庭設定。');
    }

    return createFamilyAndProfile({
      userId: session.user.id,
      mode: input.mode,
      displayName: input.displayName,
      defaultCurrency: input.defaultCurrency,
      inviteCode: input.inviteCode
    });
  }

  async function updateDisplayName(rawName: string) {
    if (!session?.user.id) {
      throw new Error('請先登入，才能修改名稱。');
    }

    const name = normalizeDisplayName(rawName);
    if (!name) {
      throw new Error('名稱不能空白。');
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: name })
      .eq('id', session.user.id);

    if (error) throw error;

    await loadProfileIntoStore(session.user.id);
  }

  async function updateFamilyName(rawName: string) {
    if (!session?.user.id) {
      throw new Error('請先登入，才能修改家庭名稱。');
    }
    if (!profile?.family_id) {
      throw new Error('尚未加入家庭，無法修改家庭名稱。');
    }

    const name = normalizeDisplayName(rawName);
    if (!name) {
      throw new Error('家庭名稱不能空白。');
    }

    const { error } = await supabase
      .from('families')
      .update({ name })
      .eq('id', profile.family_id);

    if (error) throw error;

    await loadProfileIntoStore(session.user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    reset();
  }

  return {
    session,
    user: session?.user ?? null,
    profile,
    family,
    loading,
    loadProfile: loadProfileIntoStore,
    signIn,
    signInWithGoogle,
    registerFamily,
    joinFamily,
    completeOnboarding,
    onboardingDraft: loadOnboardingDraft(),
    updateDisplayName,
    updateFamilyName,
    signOut
  };
}
