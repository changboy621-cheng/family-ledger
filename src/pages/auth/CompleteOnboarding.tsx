import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CurrencySelector } from '../../components/common/CurrencySelector';
import { clearOnboardingDraft } from '../../lib/onboarding';
import { getErrorMessage } from '../../lib/errors';
import type { Currency } from '../../types';
import { useAuth } from '../../hooks/useAuth';

export function CompleteOnboarding() {
  const { session, profile, onboardingDraft, completeOnboarding, signOut } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>(onboardingDraft?.mode ?? 'create');
  const [displayName, setDisplayName] = useState(onboardingDraft?.displayName ?? '');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>(onboardingDraft?.defaultCurrency ?? 'TWD');
  const [inviteCode, setInviteCode] = useState(onboardingDraft?.inviteCode ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }

  if (profile) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await completeOnboarding({
        mode,
        displayName,
        defaultCurrency,
        inviteCode: mode === 'join' ? inviteCode : undefined
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, '完成設定失敗'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">完成家庭設定</h1>
      <p className="mt-3 text-sm text-slate-600">
        {onboardingDraft?.requiresEmailVerification
          ? '你的信箱驗證已完成，現在把家庭設定補上就可以進入家帳。'
          : '你已登入成功，接下來只差最後一步家庭設定。'}
      </p>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setMode('create')}
          >
            建立家庭
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === 'join' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setMode('join')}
          >
            加入家庭
          </button>
        </div>

        {mode === 'join' ? (
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            邀請碼
            <input
              className="h-12 rounded-lg border border-slate-300 px-3 text-center text-xl font-bold uppercase tracking-widest outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              maxLength={6}
              required
            />
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          顯示名稱
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        <CurrencySelector value={defaultCurrency} onChange={setDefaultCurrency} label="個人預設幣別" />

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

        <button className="h-11 rounded-lg bg-family font-semibold text-white disabled:opacity-60" disabled={loading}>
          {loading ? '處理中...' : mode === 'create' ? '建立家庭' : '加入家庭'}
        </button>
      </form>

      <div className="mt-4 flex gap-3 text-sm">
        <button
          type="button"
          className="font-semibold text-slate-500"
          onClick={() => {
            clearOnboardingDraft();
            void signOut();
          }}
        >
          換個帳號重新開始
        </button>
      </div>
    </div>
  );
}
