import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { FamilyInvite } from '../components/family/FamilyInvite';
import { DataTools } from '../components/settings/DataTools';
import { SiriShortcut } from '../components/settings/SiriShortcut';
import { useUIStore } from '../store/uiStore';
import { isValidDisplayName, MAX_DISPLAY_NAME_LENGTH } from '../lib/profile';

export function Settings() {
  const { profile, family, updateDisplayName, signOut } = useAuth();
  const showToast = useUIStore((state) => state.showToast);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraftName(profile?.display_name ?? '');
    setEditing(true);
  }

  async function saveName() {
    if (!isValidDisplayName(draftName)) {
      showToast('名稱不能空白。', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateDisplayName(draftName);
      showToast('名稱已更新');
      setEditing(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '更新失敗，請稍後再試。', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">個人設定</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dt className="shrink-0 text-slate-500">顯示名稱</dt>
            <dd className="flex min-w-0 items-center gap-2">
              {editing ? (
                <>
                  <input
                    className="h-9 w-40 max-w-full min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-right outline-none focus:border-family focus:ring-2 focus:ring-family/30"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    autoFocus
                    aria-label="顯示名稱"
                  />
                  <button
                    className="grid h-9 w-9 place-items-center rounded-lg bg-family text-white disabled:opacity-60"
                    type="button"
                    onClick={() => void saveName()}
                    disabled={saving}
                    aria-label="儲存名稱"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-500"
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    aria-label="取消"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-900">{profile?.display_name}</span>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-family"
                    type="button"
                    onClick={startEdit}
                    aria-label="編輯名稱"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">預設幣別</dt>
            <dd className="font-semibold text-slate-900">{profile?.default_currency}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">家庭設定</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">家庭名稱</dt>
            <dd className="font-semibold text-slate-900">{family?.name}</dd>
          </div>
        </dl>
      </section>

      <FamilyInvite variant="plain" />

      <DataTools />

      <SiriShortcut />

      <button className="h-11 rounded-lg border border-red-200 bg-white font-semibold text-red-600" type="button" onClick={() => void signOut()}>
        登出
      </button>
    </div>
  );
}
