import type { Currency } from '../../types';
import { cn } from '../../lib/utils';

interface CurrencyBadgeProps {
  currency: Currency;
}

export function CurrencyBadge({ currency }: CurrencyBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-w-12 items-center justify-center rounded border px-2 py-1 text-xs font-semibold',
        currency === 'TWD'
          ? 'border-green-200 bg-green-100 text-green-700'
          : 'border-amber-200 bg-amber-100 text-amber-700'
      )}
    >
      {currency === 'TWD' ? 'NT$' : 'USD'}
    </span>
  );
}
