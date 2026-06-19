import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Currency } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CurrencySelector } from '../../components/common/CurrencySelector';
import { getErrorMessage } from '../../lib/errors';

export function JoinFamily() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { joinFamily } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('TWD');
  // 邀請連結帶 ?code=XXXX 時自動帶入，家人不用手動輸入
  const [inviteCode, setInviteCode] = useState(() => (searchParams.get('code') ?? '').trim().toUpperCase());
  const [verificationNotice, setVerificationNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setVerificationNotice('');
    setLoading(true);
    try {
      const result = await joinFamily(email, password, displayName, defaultCurrency, inviteCode);
      if (result.status === 'pending_verification') {
        setVerificationNotice('驗證信已寄出。請先到信箱完成驗證，再回來登入並完成加入家庭。');
        navigate('/auth/login');
        return;
      }
      navigate('/');
    } catch (joinError) {
      setError(getErrorMessage(joinError, '加入失敗'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">加入家庭</h1>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
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
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          顯示名稱
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例如：老婆"
            required
          />
        </label>
        <CurrencySelector value={defaultCurrency} onChange={setDefaultCurrency} label="個人預設幣別" />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          密碼
          <input className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
        </label>
        {verificationNotice ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{verificationNotice}</p>
        ) : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <button className="h-11 rounded-lg bg-personal font-semibold text-white disabled:opacity-60" disabled={loading}>
          {loading ? '加入中...' : '加入家庭'}
        </button>
      </form>
      <Link className="mt-5 block text-sm font-semibold text-family" to="/auth/login">
        回登入
      </Link>
    </div>
  );
}
