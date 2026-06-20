import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { Category } from '../../types';
import { cn } from '../../lib/utils';
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from '../../lib/categoryIcons';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  onCreate?: (name: string, icon: string) => Promise<Category>;
  onUpdate?: (id: string, name: string, icon: string) => Promise<Category>;
}

// editId 為 null 代表新增模式；為字串代表正在編輯該類別。
type EditorState = { editId: string | null; name: string; icon: string } | null;

export function CategoryPicker({ categories, value, onChange, onCreate, onUpdate }: CategoryPickerProps) {
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function openAdd() {
    setEditor({ editId: null, name: '', icon: DEFAULT_CATEGORY_ICON });
    setError('');
  }

  function openEdit(category: Category) {
    setEditor({ editId: category.id, name: category.name, icon: category.icon });
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

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">類別</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {categories.map((category) => {
          // 只有家庭自訂類別（有 family_id）能改圖示；系統內建類別不可編輯。
          const isCustom = Boolean(category.family_id) && Boolean(onUpdate);
          return (
            <div key={category.id} className="relative">
              <button
                type="button"
                className={cn(
                  'min-h-20 w-full rounded-lg border bg-white p-2 text-center transition focus:outline-none focus:ring-2 focus:ring-family/30',
                  value === category.id ? 'border-family text-family' : 'border-slate-200 text-slate-700'
                )}
                onClick={() => onChange(category.id)}
              >
                <span className="block text-2xl" aria-hidden="true">
                  {category.icon}
                </span>
                <span className="mt-1 block text-sm font-medium">{category.name}</span>
              </button>
              {isCustom ? (
                <button
                  type="button"
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-family"
                  onClick={() => openEdit(category)}
                  aria-label={`編輯類別 ${category.name}`}
                  title="更改圖示／名稱"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          );
        })}

        {onCreate ? (
          <button
            type="button"
            className="grid min-h-20 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-family hover:text-family focus:outline-none focus:ring-2 focus:ring-family/30"
            onClick={openAdd}
          >
            <Plus className="h-6 w-6" />
            <span className="mt-1 block text-sm font-medium">新增類別</span>
          </button>
        ) : null}
      </div>

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
