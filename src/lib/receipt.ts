/**
 * 收據辨識的純文字邏輯（不碰影像）：
 * - 電子發票證明聯左側 QR Code：格式固定，可精準取得發票號碼、日期、總金額。
 * - 一般收據的文字辨識結果（OCR）：用關鍵字猜金額與日期，準確度較低。
 */
export interface ReceiptScan {
  amount?: number;
  /** YYYY-MM-DD */
  date?: string;
  invoiceNumber?: string;
  source: 'qr' | 'ocr';
}

/**
 * 電子發票左側 QR Code 前 77 碼：
 * 發票號碼(10) + 民國日期 yyyMMdd(7) + 隨機碼(4) + 銷售額未稅 hex(8) + 總計含稅 hex(8)
 * + 買方統編(8) + 賣方統編(8) + 加密驗證(24)，之後是以「:」分隔的自訂欄位。
 * 右側 QR Code 以「**」開頭，只有品項，不處理。
 */
export function parseEInvoiceQR(text: string): ReceiptScan | null {
  const match = text.trim().match(/^([A-Z]{2}\d{8})(\d{3})(\d{2})(\d{2})\d{4}[0-9A-Fa-f]{8}([0-9A-Fa-f]{8})/);
  if (!match) return null;
  const [, invoiceNumber, rocYear, month, day, totalHex] = match;
  const year = Number(rocYear) + 1911;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  const amount = parseInt(totalHex, 16);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { invoiceNumber, date: `${year}-${month}-${day}`, amount, source: 'qr' };
}

const TOTAL_KEYWORDS = /(總計|合計|總額|總金額|應付|實付|小計|金額|TOTAL)/i;

function toNumber(raw: string): number | null {
  const value = Number(raw.replace(/[,\s]/g, ''));
  return Number.isFinite(value) && value > 0 && value < 10_000_000 ? value : null;
}

/** 從 OCR 文字猜金額、日期、發票號碼。找不到的欄位就不回傳。 */
export function parseReceiptText(text: string): ReceiptScan {
  // OCR 常把中文字之間塞空白，先拿掉，再把全形數字轉半形。
  const normalized = text
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/(?<=[一-鿿])\s+(?=[一-鿿])/g, '');
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const result: ReceiptScan = { source: 'ocr' };

  // 金額：優先取關鍵字那一行最後一個數字；取最後出現的關鍵字行（總計通常在小計下面）。
  for (const line of [...lines].reverse()) {
    if (!TOTAL_KEYWORDS.test(line)) continue;
    const numbers = line.match(/\d[\d,]*(?:\.\d{1,2})?/g);
    const value = numbers ? toNumber(numbers[numbers.length - 1]) : null;
    if (value) {
      result.amount = value;
      break;
    }
  }

  const western = normalized.match(/(20\d{2})[./\-年](\d{1,2})[./\-月](\d{1,2})/);
  const roc = normalized.match(/(?<!\d)(1\d{2})[./\-年](\d{1,2})[./\-月](\d{1,2})/);
  const pick = western ? [Number(western[1]), western[2], western[3]] : roc ? [Number(roc[1]) + 1911, roc[2], roc[3]] : null;
  if (pick) {
    const [year, month, day] = pick as [number, string, string];
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      result.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  const invoice = normalized.match(/\b([A-Z]{2})-?(\d{8})\b/);
  if (invoice) result.invoiceNumber = `${invoice[1]}${invoice[2]}`;

  return result;
}
