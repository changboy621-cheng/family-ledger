import type { PaymentMethod } from '../types';

// 跨檔案共用的常數單一來源，取代散落各處的字面值。

export const PAYMENT_METHOD_DISPLAY: Record<PaymentMethod | 'unspecified', { label: string; icon: string }> = {
  cash: { label: '現金', icon: '💵' },
  card: { label: '刷卡', icon: '💳' },
  unspecified: { label: '未指定', icon: '🧾' }
};

/** 付款方式的中文標籤；未指定/空值回傳空字串（沿用 CSV 匯出行為）。 */
export function paymentMethodLabel(method: PaymentMethod | null | undefined): string {
  return method ? PAYMENT_METHOD_DISPLAY[method].label : '';
}

/** 無頭像顏色時的預設色（slate-500）。 */
export const DEFAULT_AVATAR_COLOR = '#64748B';

/** 帳本頁趨勢圖顯示的月數；rollingMonthRange 的回看月數為 TREND_MONTHS - 1。 */
export const TREND_MONTHS = 6;
export const TREND_MONTHS_BACK = TREND_MONTHS - 1;
