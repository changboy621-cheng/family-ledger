import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthRange(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}

export function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function rollingMonthRange(yearMonth: string, monthsBack: number) {
  const [year, month] = yearMonth.split('-').map(Number);
  const end = new Date(year, month, 0);
  const start = new Date(year, month - monthsBack, 1);

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}
