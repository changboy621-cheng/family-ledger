import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category } from '../../types';
import { cn } from '../../lib/utils';
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from '../../lib/categoryIcons';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  onCreate?: (name: string, icon: string) => Promise<Category>;
  onUpdate?: (id: string, name: string, icon: string) => Promise<Category>;
  onDelete?: (id: string) => Promise<void>;
}

// editId 為 null 代表新增模式；為字串代表正在編輯該類別。
type EditorState = { editId: string | null; name: string; icon: string } | null;

export function CategoryPicker({ categories, value, onChange, onCreate, onUpdate, onDelete }: CategoryPickerProps) {
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const selected = categories.find((category) => category.id === value) ?? null;
  // 只有家庭自有的類別（有 family_id）能編輯／刪除；migration 後內建類別亦具 family_id。
  const canModifySelected = Boolean(selected?.family_id);

  function openAdd() {
    setEditor({ editId: null, name: '', icon: DEFAULT_CATEGORY_ICON });
    setPendingDelete(false);
    setError('');
  }

  function openEdit() {
    if (!selected) return;
    setEditor({ editId: selected.id, name: selected.name, icon: selected.icon });
    setPendingDelete(false);
    setError('');
  }

  function closeEditor() {
    setEditor(null);
    setError('');
  }

  async function handleSave() {
    if (!editor) return;
    if (!editor.name.trim()) {
      setError('請輸入類別名稱。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved =
        editor.editId && onUpdate
          ? await onUpdate(editor.editId, editor.name, editor.icon)
          : onCreate
            ? await onCreate(editor.name, editor.icon)
            : null;
      if (saved) onChange(saved.id);
      closeEditor();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '儲存失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected || !onDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete(selected.id);
      setPendingDelete(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '刪除失敗，請稍後再試。');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">類別</span>
        <select
          aria-label="類別"
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </label>

      {!editor ? (
        <div className="flex flex-wrap items-center gap-2">
          {onCreate ? (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-family hover:text-family"
            >
              <Plus className="h-4 w-4" /> 新增
            </button>
          ) : null}

          {onUpdate && canModifySelected ? (
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-family hover:text-family"
            >
              <Pencil className="h-4 w-4" /> 編輯
            </button>
          ) : null}

          {onDelete && canModifySelected && !pendingDelete ? (
            <button
              type="button"
              onClick={() => {
                setPendingDelete(true);
                setError('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" /> 刪除
            </button>
          ) : null}

          {onDelete && canModifySelected && pendingDelete ? (
            <div className="inline-flex items-center gap-2">
              <span className="text-sm text-slate-600">刪除「{selected?.name}」？</span>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600"
              >
                取消
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!editor && error ? <p className="text-sm text-red-600">{error}</p> : null}

      {editor ? (
        <div className="mt-1 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-700">{editor.editId ? '編輯類別' : '新增類別'}</p>
          <div className="flex items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-2xl">
              {editor.icon}
            </span>
            <input
              className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
              value={editor.name}
              onChange={(event) => setEditor((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
              placeholder="類別名稱，例如：寵物、孝親"
              maxLength={12}
              autoFocus
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">選擇圖示</p>
            <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto">
              {CATEGORY_ICONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-lg border text-xl transition',
                    editor.icon === option
                      ? 'border-family bg-familySoft'
                      : 'border-transparent bg-white hover:border-slate-200'
                  )}
                  onClick={() => setEditor((prev) => (prev ? { ...prev, icon: option } : prev))}
                  aria-label={`圖示 ${option}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-10 flex-1 rounded-lg bg-family font-semibold text-white disabled:opacity-60"
            >
              {saving ? '儲存中...' : editor.editId ? '儲存變更' : '新增類別'}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              disabled={saving}
              className="h-10 flex-1 rounded-lg border border-slate-300 font-semibold text-slate-600"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
