import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../lib/errors';

export function Login() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (signInError) {
      setError(getErrorMessage(signInError, '登入失敗'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">登入</h1>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          密碼
          <input
            className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <button className="h-11 rounded-lg bg-family font-semibold text-white disabled:opacity-60" disabled={loading}>
          {loading ? '登入中...' : '登入'}
        </button>
      </form>
      <button
        className="mt-3 h-11 w-full rounded-lg border border-slate-300 font-semibold text-slate-700"
        type="button"
        onClick={() => void signInWithGoogle()}
      >
        使用 Google 登入
      </button>
      <div className="mt-5 grid gap-2 text-sm text-slate-600">
        <Link className="font-semibold text-family" to="/auth/register">
          第一次使用，建立家庭
        </Link>
        <Link className="font-semibold text-personal" to="/auth/join">
          我有邀請碼，加入家庭
        </Link>
      </div>
    </div>
  );
}
