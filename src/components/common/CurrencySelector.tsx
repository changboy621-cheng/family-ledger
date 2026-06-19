import type { Currency } from '../../types';
import { currencies } from '../../lib/currency';

interface CurrencySelectorProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  label?: string;
}

export function CurrencySelector({ value, onChange, label = '幣別' }: CurrencySelectorProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <select
        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-indigo-100"
        value={value}
        onChange={(event) => onChange(event.target.value as Currency)}
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.label}
          </option>
        ))}
      </select>
    </label>
  );
}
