import { useAuth } from '../hooks/useAuth';

export function Settings() {
  const { profile, family, signOut } = useAuth();

  async function copyInviteCode() {
    if (family?.invite_code) await navigator.clipboard.writeText(family.invite_code);
  }

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">個人設定</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">顯示名稱</dt>
            <dd className="font-semibold text-slate-900">{profile?.display_name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">預設幣別</dt>
            <dd className="font-semibold text-slate-900">{profile?.default_currency}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">家庭設定</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">家庭名稱</dt>
            <dd className="font-semibold text-slate-900">{family?.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">邀請碼</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold tracking-widest text-family">{family?.invite_code}</span>
              <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold" type="button" onClick={() => void copyInviteCode()}>
                複製
              </button>
            </dd>
          </div>
        </dl>
      </section>

      <button className="h-11 rounded-lg border border-red-200 bg-white font-semibold text-red-600" type="button" onClick={() => void signOut()}>
        登出
      </button>
    </div>
  );
}
