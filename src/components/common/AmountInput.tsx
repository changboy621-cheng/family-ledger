import { Delete } from 'lucide-react';
import type { Currency } from '../../types';
import { formatAmount, getAmountConfig } from '../../lib/currency';
import { evaluateExpression, sanitizeExpressionInput } from '../../lib/expression';

interface AmountInputProps {
  currency: Currency;
  value: string;
  onChange: (value: string) => void;
}

const OPERATORS: { label: string; token: string }[] = [
  { label: '+', token: '+' },
  { label: '−', token: '-' },
  { label: '×', token: '*' },
  { label: '÷', token: '/' }
];

export function AmountInput({ currency, value, onChange }: AmountInputProps) {
  const config = getAmountConfig(currency);
  const hasOperator = /[+\-*/]/.test(value);
  const result = hasOperator ? evaluateExpression(value) : null;

  function append(token: string) {
    onChange(sanitizeExpressionInput(value + token));
  }

  function backspace() {
    onChange(value.slice(0, -1));
  }

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      金額
      <input
        className="h-14 rounded-lg border border-slate-300 bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus:border-family focus:ring-2 focus:ring-family/30"
        inputMode={config.inputMode}
        placeholder={config.placeholder}
        value={value}
        onChange={(event) => onChange(sanitizeExpressionInput(event.target.value))}
      />

      <div className="grid grid-cols-5 gap-2">
        {OPERATORS.map((operator) => (
          <button
            key={operator.token}
            type="button"
            className="h-10 rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-700 active:bg-slate-50"
            onClick={() => append(operator.token)}
            aria-label={`輸入 ${operator.label}`}
          >
            {operator.label}
          </button>
        ))}
        <button
          type="button"
          className="grid h-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 active:bg-slate-50"
          onClick={backspace}
          aria-label="刪除一個字"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>

      {hasOperator ? (
        <span className="text-sm font-semibold text-family">
          = {result !== null ? formatAmount(result, currency) : '—'}
        </span>
      ) : (
        <span className="text-xs font-normal text-slate-500">
          {currency === 'TWD' ? '可直接算式輸入，例如 120+80；新台幣自動取整數' : '可直接算式輸入，例如 12*3；美金支援兩位小數'}
        </span>
      )}
    </label>
  );
}
