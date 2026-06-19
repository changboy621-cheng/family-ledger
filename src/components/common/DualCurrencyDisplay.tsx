import { formatAmount } from '../../lib/currency';

interface DualCurrencyDisplayProps {
  title: string;
  values: { TWD: number; USD: number };
}

export function DualCurrencyDisplay({ title, values }: DualCurrencyDisplayProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{formatAmount(values.TWD, 'TWD')}</p>
      {values.USD !== 0 ? (
        <p className="mt-1 text-xl font-semibold text-slate-700">{formatAmount(values.USD, 'USD')}</p>
      ) : null}
    </div>
  );
}
