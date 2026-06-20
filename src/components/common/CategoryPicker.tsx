import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category } from '../../types';
import { cn } from '../../lib/utils';
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from '../../lib/categoryIcons';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  onCreate?: (name: string, icon: string) => Promise<Category>;
}

export function CategoryPicker({ categories, value, onChange, onCreate }: CategoryPickerProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setAdding(false);
    setName('');
    setIcon(DEFAULT_CATEGORY_ICON);
    setError('');
  }

  async function handleCreate() {
    if (!onCreate) return;
    if (!name.trim()) {
      setError('請輸入類別名稱。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await onCreate(name, icon);
      onChange(created.id);
      resetForm();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '新增類別失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">類別</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={cn(
              'min-h-20 rounded-lg border bg-white p-2 text-center transition focus:outline-none focus:ring-2 focus:ring-family/30',
              value === category.id ? 'border-family text-family' : 'border-slate-200 text-slate-700'
            )}
            onClick={() => onChange(category.id)}
          >
            <span className="block text-2xl" aria-hidden="true">
              {category.icon}
            </span>
            <span className="mt-1 block text-sm font-medium">{category.name}</span>
          </button>
        ))}

        {onCreate ? (
          <button
            type="button"
            className="grid min-h-20 place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-family hover:text-family focus:outline-none focus:ring-2 focus:ring-family/30"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-6 w-6" />
            <span className="mt-1 block text-sm font-medium">新增類別</span>
          </button>
        ) : null}
      </div>

      {adding && onCreate ? (
        <div className="mt-1 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-2xl">
              {icon}
            </span>
            <input
              className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
              value={name}
              onChange={(event) => setName(event.target.value)}
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
                    icon === option ? 'border-family bg-familySoft' : 'border-transparent bg-white hover:border-slate-200'
                  )}
                  onClick={() => setIcon(option)}
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
              onClick={() => void handleCreate()}
              disabled={saving}
              className="h-10 flex-1 rounded-lg bg-family font-semibold text-white disabled:opacity-60"
            >
              {saving ? '新增中...' : '新增類別'}
            </button>
            <button
              type="button"
              onClick={resetForm}
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
