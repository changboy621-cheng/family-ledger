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

/** 依可信度排序：先找總計類，找不到才退而求其次用小計類。 */
const AMOUNT_TIERS = [/(總計|總金額|總額|合計|應付|實付|(?<!SUB)TOTAL)/i, /(小計|金額|SUBTOTAL)/i];
/** 不是消費金額的欄位：出現在關鍵字前面整行跳過（找零金額、未稅金額），出現在後面就截斷（總計 486 找零 14）。 */
const NOT_AMOUNT = /(找零|未稅|稅額|銷售額|實收|收現|信用卡|折扣|折讓|優惠|點數|紅利|統編|電話|TEL)/i;

/** 從一段文字取最後一個像金額的數字；跳過 0 開頭或 8 碼以上的（統編、電話）。 */
function lastAmount(segment: string): number | null {
  const cleaned = segment
    .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0') // OCR 把 0 認成 O
    .replace(/(?<=\d)[lI]|[lI](?=\d)/g, '1') // OCR 把 1 認成 l / I
    .replace(/(\d),\s+(?=\d{3}(?!\d))/g, '$1,'); // 「1, 486」
  const tokens = cleaned.match(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g) ?? [];
  for (const token of tokens.reverse()) {
    const digits = token.replace(/[,.].*$/, '').replace(/,/g, '');
    if ((digits.length > 1 && digits.startsWith('0')) || (!token.includes(',') && digits.length >= 8)) continue;
    const value = Number(token.replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0 && value < 10_000_000) return value;
  }
  return null;
}

function findAmount(lines: string[]): number | undefined {
  for (const tier of AMOUNT_TIERS) {
    // 同一層取最後出現的（總計通常在合計下面）。
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = tier.exec(lines[i]);
      if (!match || NOT_AMOUNT.test(lines[i].slice(0, match.index))) continue;
      let segment = lines[i].slice(match.index + match[0].length);
      const stop = NOT_AMOUNT.exec(segment);
      if (stop) segment = segment.slice(0, stop.index);
      // 關鍵字那行沒數字時，OCR 常把金額拆到下一行。
      const next = lines[i + 1];
      const value =
        lastAmount(segment) ??
        (next && !AMOUNT_TIERS.some((t) => t.test(next)) && !NOT_AMOUNT.test(next) ? lastAmount(next) : null);
      if (value) return value;
    }
  }
  return undefined;
}

/** 從 OCR 文字猜金額、日期、發票號碼。找不到的欄位就不回傳。 */
export function parseReceiptText(text: string): ReceiptScan {
  // OCR 常把中文字之間塞空白，先拿掉，再把全形數字轉半形。
  const normalized = text
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/(?<=[一-鿿])\s+(?=[一-鿿])/g, '');
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const result: ReceiptScan = { source: 'ocr' };

  const amount = findAmount(lines);
  if (amount) result.amount = amount;

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
