import { Lock, Users } from 'lucide-react';
import { formatAmount } from '../../lib/currency';

interface DualCurrencyDisplayProps {
  title: string;
  values: { TWD: number; USD: number };
  /** 帳本身分：顯示對應的顏色圖示，一眼分出家庭／個人。 */
  tone?: 'family' | 'personal';
}

export function DualCurrencyDisplay({ title, values, tone }: DualCurrencyDisplayProps) {
  const Icon = tone === 'personal' ? Lock : Users;
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2.5">
        {tone ? (
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              tone === 'family' ? 'bg-familySoft text-family' : 'bg-personalSoft text-personal'
            }`}
            aria-hidden="true"
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
        <p className="min-w-0 text-sm font-semibold leading-tight text-slate-600">{title}</p>
      </div>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{formatAmount(values.TWD, 'TWD')}</p>
      {values.USD !== 0 ? (
        <p className="mt-1 truncate text-lg font-semibold text-slate-700">{formatAmount(values.USD, 'USD')}</p>
      ) : null}
    </div>
  );
}
