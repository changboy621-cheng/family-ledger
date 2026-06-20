import { Delete } from 'lucide-react';
import type { Currency } from '../../types';
import { formatAmount } from '../../lib/currency';
import { evaluateExpression, sanitizeExpressionInput } from '../../lib/expression';

interface AmountInputProps {
  currency: Currency;
  value: string;
  onChange: (value: string) => void;
}

type Key = { key: string; label: string; kind: 'num' | 'op' | 'back' };

const KEYPAD: Key[][] = [
  [
    { key: '7', label: '7', kind: 'num' },
    { key: '8', label: '8', kind: 'num' },
    { key: '9', label: '9', kind: 'num' },
    { key: '/', label: '÷', kind: 'op' }
  ],
  [
    { key: '4', label: '4', kind: 'num' },
    { key: '5', label: '5', kind: 'num' },
    { key: '6', label: '6', kind: 'num' },
    { key: '*', label: '×', kind: 'op' }
  ],
  [
    { key: '1', label: '1', kind: 'num' },
    { key: '2', label: '2', kind: 'num' },
    { key: '3', label: '3', kind: 'num' },
    { key: '-', label: '−', kind: 'op' }
  ],
  [
    { key: '0', label: '0', kind: 'num' },
    { key: '.', label: '.', kind: 'num' },
    { key: '⌫', label: '⌫', kind: 'back' },
    { key: '+', label: '+', kind: 'op' }
  ]
];

function prettyExpression(value: string) {
  return value.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/-/g, ' − ').replace(/\+/g, ' + ');
}

export function AmountInput({ currency, value, onChange }: AmountInputProps) {
  const hasOperator = /[+\-*/]/.test(value);
  const result = hasOperator ? evaluateExpression(value) : null;

  function press(item: Key) {
    if (item.kind === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    onChange(sanitizeExpressionInput(value + item.key));
  }

  return (
    <div className="grid gap-2 text-sm font-medium text-slate-700">
      金額
      <div className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-right">
        <p className="min-h-9 text-3xl font-semibold text-slate-900">{value ? prettyExpression(value).trim() : '0'}</p>
        {hasOperator ? (
          <p className="text-sm font-semibold text-family">= {result !== null ? formatAmount(result, currency) : '—'}</p>
        ) : (
          <p className="text-xs font-normal text-slate-400">{currency === 'TWD' ? '新台幣自動取整數' : '美金兩位小數'}</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {KEYPAD.flat().map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => press(item)}
            aria-label={item.kind === 'back' ? '刪除一個字' : item.label}
            className={`grid h-14 place-items-center rounded-lg text-2xl font-semibold active:scale-95 ${
              item.kind === 'op'
                ? 'bg-familySoft text-family'
                : item.kind === 'back'
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-slate-50 text-slate-900'
            }`}
          >
            {item.kind === 'back' ? <Delete className="h-6 w-6" /> : item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
