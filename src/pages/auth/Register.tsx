import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Currency } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CurrencySelector } from '../../components/common/CurrencySelector';
import { getErrorMessage } from '../../lib/errors';

export function Register() {
  const navigate = useNavigate();
  const { registerFamily } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('TWD');
  const [inviteCode, setInviteCode] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setVerificationNotice('');
    setLoading(true);
    try {
      const result = await registerFamily(email, password, displayName, defaultCurrency);
      if (result.status === 'pending_verification') {
        setVerificationNotice('驗證信已寄出。請先到信箱完成驗證，再回來登入並完成家庭設定。');
        navigate('/auth/login');
        return;
      }
      setInviteCode(result.family.invite_code);
    } catch (registerError) {
      setError(getErrorMessage(registerError, '註冊失敗'));
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(inviteCode);
  }

  if (inviteCode) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900">家庭已建立</h1>
        <p className="mt-3 text-sm text-slate-600">把邀請碼分享給另一半，對方就能加入同一個家庭帳本。</p>
        <div className="mt-5 rounded-lg bg-indigo-50 p-5 text-center">
          <p className="text-sm font-medium text-slate-500">邀請碼</p>
          <p className="mt-2 text-4xl font-bold tracking-widest text-family">{inviteCode}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="h-11 rounded-lg border border-slate-300 font-semibold" type="button" onClick={() => void copyInviteCode()}>
            複製
          </button>
          <button className="h-11 rounded-lg bg-family font-semibold text-white" type="button" onClick={() => navigate('/')}>
            進入家帳
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">建立家庭</h1>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          顯示名稱
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例如：老公"
            required
          />
        </label>
        <CurrencySelector value={defaultCurrency} onChange={setDefaultCurrency} label="個人預設幣別" />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          密碼
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
        {verificationNotice ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{verificationNotice}</p>
        ) : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <button className="h-11 rounded-lg bg-family font-semibold text-white disabled:opacity-60" disabled={loading}>
          {loading ? '建立中...' : '建立家庭並產生邀請碼'}
        </button>
      </form>
      <Link className="mt-5 block text-sm font-semibold text-family" to="/auth/login">
        已有帳號，回登入
      </Link>
    </div>
  );
}
