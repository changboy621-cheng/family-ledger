import { useAuth } from '../hooks/useAuth';
import { FamilyInvite } from '../components/family/FamilyInvite';
import { DataTools } from '../components/settings/DataTools';
import { SiriShortcut } from '../components/settings/SiriShortcut';
import { InlineEditField } from '../components/common/InlineEditField';
import { isValidDisplayName, MAX_DISPLAY_NAME_LENGTH } from '../lib/profile';

export function Settings() {
  const { profile, family, updateDisplayName, updateFamilyName, signOut } = useAuth();

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">個人設定</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <InlineEditField
            label="顯示名稱"
            value={profile?.display_name ?? ''}
            onSave={updateDisplayName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            isValid={isValidDisplayName}
            invalidMessage="名稱不能空白。"
          />
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">預設幣別</dt>
            <dd className="font-semibold text-slate-900">{profile?.default_currency}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">家庭設定</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <InlineEditField
            label="家庭名稱"
            value={family?.name ?? ''}
            onSave={updateFamilyName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            isValid={isValidDisplayName}
            invalidMessage="家庭名稱不能空白。"
          />
        </dl>
      </section>

      <FamilyInvite variant="plain" />

      <DataTools />

      <SiriShortcut />

      <button className="h-11 rounded-lg border border-red-200 bg-white font-semibold text-red-600" type="button" onClick={() => void signOut()}>
        登出
      </button>

      <p className="pt-2 text-center text-xs text-slate-400">版本 {__BUILD_TIME__}</p>
    </div>
  );
}
