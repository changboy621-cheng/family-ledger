import type { Currency } from '../../types';
import { getAmountConfig, sanitizeAmountInput } from '../../lib/currency';

interface AmountInputProps {
  currency: Currency;
  value: string;
  onChange: (value: string) => void;
}

export function AmountInput({ currency, value, onChange }: AmountInputProps) {
  const config = getAmountConfig(currency);

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      金額
      <input
        className="h-14 rounded-lg border border-slate-300 bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
        inputMode={config.inputMode}
        min="0"
        step={config.step}
        placeholder={config.placeholder}
        value={value}
        onChange={(event) => onChange(sanitizeAmountInput(event.target.value, currency))}
      />
      <span className="text-xs font-normal text-slate-500">
        {currency === 'TWD' ? '新台幣會自動取整數' : '美金支援兩位小數'}
      </span>
    </label>
  );
}
