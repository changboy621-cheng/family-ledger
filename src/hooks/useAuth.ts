import { useCallback } from 'react';
import type { Currency, Family } from '../types';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useReferenceStore } from '../store/referenceStore';
import { parseInviteFamily } from '../lib/schemas';
import { loadProfileIntoStore } from './loadProfileIntoStore';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  resolveRegistrationStage,
  saveOnboardingDraft,
  type OnboardingMode
} from '../lib/onboarding';
import { normalizeDisplayName } from '../lib/profile';
import { buildFamilyCategoryRows } from '../lib/defaultCategories';

const AVATAR_COLORS = ['#4F46E5', '#0EA5E9', '#15803D', '#B45309', '#EF4444'];

function pickAvatarColor(seed: string) {
  const index = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

interface ProfileInput {
  displayName: string;
  defaultCurrency: Currency;
}

function profileRpcArgs({ displayName, defaultCurrency }: ProfileInput) {
  return {
    p_display_name: displayName,
    p_avatar_color: pickAvatarColor(displayName),
    p_default_currency: defaultCurrency
  };
}

// 建立家庭＋綁定自己的 profile：一律走 SECURITY DEFINER 的 create_family_with_profile RPC，
// 前端不再直接 insert families 或寫 user_profiles.family_id（見 migration 014）。
export async function createFamilyViaRpc(input: ProfileInput): Promise<Family> {
  const { data, error } = await supabase.rpc('create_family_with_profile', profileRpcArgs(input));
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!parseInviteFamily(row)) throw new Error('建立家庭未完成，請稍後再試一次。');
  return row as Family;
}

// 家庭建立時植入預設類別（每個家庭各自持有一份，取代過去全域共用的內建類別）。
// 必須在該使用者的 user_profiles 建立後呼叫，RLS 的 get_my_family_id() 才會回傳新家庭、通過 insert 檢查。
// 非致命：植入失敗時僅記錄警告，不阻斷註冊流程（使用者仍可手動新增類別）。
export async function seedFamilyCategories(familyId: string) {
  const { error } = await supabase.from('categories').insert(buildFamilyCategoryRows(familyId));
  if (error) {
    console.warn('植入預設類別失敗：', error.message);
  }
}

// 用邀請碼加入家庭＋綁定自己的 profile：走 SECURITY DEFINER 的 join_family_with_profile RPC，
// 必須拿得出正確邀請碼才能加入，無法憑家庭 uuid 直接改 family_id。
export async function joinFamilyViaRpc(rawCode: string, input: ProfileInput): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.rpc('join_family_with_profile', {
    p_code: rawCode?.trim().toUpperCase() ?? '',
    ...profileRpcArgs(input)
  });
  const row = (Array.isArray(data) ? data[0] : data) as { family_id?: unknown; family_name?: unknown } | null;
  const family = parseInviteFamily(row ? { id: row.family_id, name: row.family_name } : null);
  if (error || !family) {
    throw new Error('找不到這組邀請碼，請確認大小寫與數字。');
  }
  return family;
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
      const profileInput = { displayName, defaultCurrency };
      const familyData =
        mode === 'create'
          ? await createFamilyViaRpc(profileInput)
          : await joinFamilyViaRpc(inviteCode ?? '', profileInput);

      // 只有新建家庭需要植入預設類別；加入既有家庭時沿用該家庭已有的類別。
      if (mode === 'create') {
        await seedFamilyCategories(familyData.id);
      }

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

    // mode 'create' 一定回傳完整 Family（含 invite_code，註冊完成頁要顯示）
    const family = (await createFamilyAndProfile({
      userId: data.user.id,
      mode: 'create',
      displayName,
      defaultCurrency
    })) as Family;

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
    // 成員快取含顯示名稱，改名後需失效，否則「幫誰記帳」選單仍顯示舊名。
    if (profile?.family_id) await useReferenceStore.getState().reloadMembers(profile.family_id);
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

  // 儲存家庭自訂的類別顯示順序（依序排列的 category id）。
  // 先樂觀更新 store（讓拖曳結果立即反映、不等網路），失敗再還原。
  async function updateCategoryOrder(orderedIds: string[]) {
    if (!profile?.family_id) {
      throw new Error('尚未加入家庭，無法調整類別順序。');
    }

    const { setFamily } = useAuthStore.getState();
    const prevFamily = family;
    if (prevFamily) setFamily({ ...prevFamily, category_order: orderedIds });

    const { error } = await supabase
      .from('families')
      .update({ category_order: orderedIds })
      .eq('id', profile.family_id);

    if (error) {
      if (prevFamily) setFamily(prevFamily); // 還原樂觀更新
      throw error;
    }
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
    updateCategoryOrder,
    signOut
  };
}
