import type { Category } from '../../types';
import { cn } from '../../lib/utils';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">類別</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={cn(
              'min-h-20 rounded-lg border bg-white p-2 text-center transition focus:outline-none focus:ring-2 focus:ring-indigo-100',
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
      </div>
    </div>
  );
}
