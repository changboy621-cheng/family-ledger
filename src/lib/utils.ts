import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 以「本地時區」格式化 YYYY-MM-DD。
// 注意：不可用 toISOString()，它會轉成 UTC，在 UTC+ 時區會把當地日期往前推一天，
// 導致每月範圍少抓當月最後一天、誤抓上月最後一天（Asia/Taipei 等實測會漏資料）。
function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return formatLocalDate(new Date());
}

export function monthRange(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    from: formatLocalDate(start),
    to: formatLocalDate(end)
  };
}

export function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function rollingMonthRange(yearMonth: string, monthsBack: number) {
  const [year, month] = yearMonth.split('-').map(Number);
  const end = new Date(year, month, 0);
  const start = new Date(year, month - monthsBack, 1);

  return {
    from: formatLocalDate(start),
    to: formatLocalDate(end)
  };
}
