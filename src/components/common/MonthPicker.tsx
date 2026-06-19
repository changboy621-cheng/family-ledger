import { addMonths, format } from 'date-fns';

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const current = new Date(`${value}-01T00:00:00`);

  function move(months: number) {
    onChange(format(addMonths(current, months), 'yyyy-MM'));
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
      <button className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100" type="button" onClick={() => move(-1)}>
        上月
      </button>
      <strong className="text-slate-900">{format(current, 'yyyy / MM')}</strong>
      <button className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100" type="button" onClick={() => move(1)}>
        下月
      </button>
    </div>
  );
}
