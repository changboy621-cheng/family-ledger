import { useAuth } from '../hooks/useAuth';
import { FamilyInvite } from '../components/family/FamilyInvite';

export function Settings() {
  const { profile, family, signOut } = useAuth();

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
        </dl>
      </section>

      <FamilyInvite variant="plain" />

      <button className="h-11 rounded-lg border border-red-200 bg-white font-semibold text-red-600" type="button" onClick={() => void signOut()}>
        登出
      </button>
    </div>
  );
}
