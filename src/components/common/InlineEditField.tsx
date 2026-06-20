import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

interface InlineEditFieldProps {
  label: string;
  value: string;
  onSave: (next: string) => Promise<void>;
  maxLength?: number;
  isValid?: (value: string) => boolean;
  invalidMessage?: string;
}

// 設定頁共用的「顯示值＋鉛筆編輯」列，內建編輯狀態與儲存提示。
export function InlineEditField({
  label,
  value,
  onSave,
  maxLength,
  isValid,
  invalidMessage = '內容不能空白。'
}: InlineEditFieldProps) {
  const showToast = useUIStore((state) => state.showToast);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  async function save() {
    if (isValid && !isValid(draft)) {
      showToast(invalidMessage, 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      showToast('已更新');
      setEditing(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '更新失敗，請稍後再試。', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        {editing ? (
          <>
            <input
              className="h-9 w-40 min-w-0 max-w-full flex-1 rounded-lg border border-slate-300 px-3 text-right outline-none focus:border-family focus:ring-2 focus:ring-family/30"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={maxLength}
              autoFocus
              aria-label={label}
            />
            <button
              className="grid h-9 w-9 place-items-center rounded-lg bg-family text-white disabled:opacity-60"
              type="button"
              onClick={() => void save()}
              disabled={saving}
              aria-label="儲存"
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
            <span className="font-semibold text-slate-900">{value}</span>
            <button
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-family"
              type="button"
              onClick={startEdit}
              aria-label={`編輯${label}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
      </dd>
    </div>
  );
}
