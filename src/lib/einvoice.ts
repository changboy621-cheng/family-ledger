import type { Category } from '../types';

/**
 * 財政部電子發票整合服務平台下載的「載具消費明細」解析。
 * 支援兩種格式：
 * 1. 直線分隔（舊版）：M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|
 *                      D|發票號碼|小計|品項名稱|
 * 2. 逗號 CSV（有標題列）：欄位名稱含「發票號碼」「發票日期」「總金額／發票金額」「商店店名／賣方名稱」等，
 *    同一張發票多個品項時會有多列，依發票號碼合併。
 */
export interface EInvoice {
  number: string;
  /** YYYY-MM-DD */
  date: string;
  seller: string;
  sellerId: string;
  total: number;
  items: string[];
}

export interface EInvoiceParseResult {
  invoices: EInvoice[];
  /** 作廢、註銷等不需記帳的發票。 */
  voided: number;
  /** 格式看不懂的列。 */
  invalid: number;
}

const INVOICE_NO = /^[A-Z]{2}-?\d{8}$/;

export function normalizeInvoiceNumber(raw: string): string | null {
  const value = raw.trim().toUpperCase().replace('-', '');
  return INVOICE_NO.test(value) ? value : null;
}

/** 20231201、2023/12/01、2023-12-01、112/12/01（民國）、1121201（民國 7 碼）→ 2023-12-01 */
export function normalizeInvoiceDate(raw: string): string | null {
  const value = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = value.match(/^(\d{4})[/-]?(\d{1,2})[/-]?(\d{1,2})$/);
  if (match && value.replace(/\D/g, '').length >= 8) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = value.match(/^(\d{2,3})[/-](\d{1,2})[/-](\d{1,2})$/))) {
    [year, month, day] = [Number(match[1]) + 1911, Number(match[2]), Number(match[3])];
  } else if ((match = value.match(/^(\d{3})(\d{2})(\d{2})$/))) {
    [year, month, day] = [Number(match[1]) + 1911, Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isVoided(status: string) {
  return /作廢|註銷|取消/.test(status);
}

function parseAmount(raw: string): number | null {
  const value = Number(raw.replace(/[,\s$元]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function parsePipe(lines: string[]): EInvoiceParseResult {
  const byNumber = new Map<string, EInvoice>();
  let voided = 0;
  let invalid = 0;
  for (const line of lines) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells[0] === 'M') {
      const number = normalizeInvoiceNumber(cells[6] ?? '');
      const date = normalizeInvoiceDate(cells[3] ?? '');
      const total = parseAmount(cells[7] ?? '');
      if (!number || !date || total === null) {
        invalid += 1;
        continue;
      }
      if (isVoided(cells[8] ?? '')) {
        voided += 1;
        continue;
      }
      byNumber.set(number, { number, date, seller: cells[5] ?? '', sellerId: cells[4] ?? '', total, items: [] });
    } else if (cells[0] === 'D') {
      const number = normalizeInvoiceNumber(cells[1] ?? '');
      const item = cells[3];
      if (number && item) byNumber.get(number)?.items.push(item);
    }
  }
  return { invoices: [...byNumber.values()].filter((invoice) => invoice.total > 0), voided, invalid };
}

function parseDelimited(rows: string[][]): EInvoiceParseResult {
  const header = rows[0].map((cell) => cell.trim());
  const col = (...names: string[]) => header.findIndex((cell) => names.some((name) => cell.includes(name)));
  const iNumber = col('發票號碼');
  const iDate = col('發票日期', '消費日期');
  const iTotal = col('總金額', '發票金額');
  const iSeller = col('商店店名', '賣方名稱', '店家名稱');
  const iSellerId = col('商店統編', '賣方統一編號', '賣方統編');
  const iStatus = col('發票狀態');
  const iItem = col('品名', '品項名稱');
  const byNumber = new Map<string, EInvoice>();
  const voidedNumbers = new Set<string>();
  let invalid = 0;
  for (const row of rows.slice(1)) {
    if (row.every((cell) => !cell.trim())) continue;
    const number = normalizeInvoiceNumber(row[iNumber] ?? '');
    const date = normalizeInvoiceDate(row[iDate] ?? '');
    const total = parseAmount(row[iTotal] ?? '');
    if (!number || !date || total === null) {
      invalid += 1;
      continue;
    }
    if (iStatus >= 0 && isVoided(row[iStatus] ?? '')) {
      voidedNumbers.add(number);
      continue;
    }
    const existing = byNumber.get(number);
    const item = iItem >= 0 ? row[iItem]?.trim() : '';
    if (existing) {
      if (item) existing.items.push(item);
      continue;
    }
    byNumber.set(number, {
      number,
      date,
      seller: iSeller >= 0 ? row[iSeller]?.trim() ?? '' : '',
      sellerId: iSellerId >= 0 ? row[iSellerId]?.trim() ?? '' : '',
      total,
      items: item ? [item] : []
    });
  }
  return { invoices: [...byNumber.values()].filter((invoice) => invoice.total > 0), voided: voidedNumbers.size, invalid };
}

/** 判斷內容是否為載具明細（給匯入流程自動辨識）。 */
export function looksLikeEInvoice(text: string): boolean {
  return /(^|\n)\s*(表頭=)?M\|/.test(text) || (/發票號碼/.test(text) && /(總金額|發票金額)/.test(text));
}

export function parseEInvoiceText(text: string, parseCsvRows: (text: string) => string[][]): EInvoiceParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  // 「表頭=」「明細=」開頭的是欄位說明列，不是資料。
  const lines = clean.split(/\r?\n/).filter((line) => line.trim() && !/^(表頭|明細)=/.test(line.trim()));
  if (lines.some((line) => /^M\|/.test(line))) return parsePipe(lines);
  const rows = parseCsvRows(clean);
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.includes('發票號碼')));
  if (headerIndex < 0) return { invoices: [], voided: 0, invalid: rows.length };
  return parseDelimited(rows.slice(headerIndex));
}

/** 檔案可能是 UTF-8 或 Big5（舊版平台）；先試 UTF-8，有亂碼再用 Big5。 */
export function decodeInvoiceFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('big5').decode(buffer);
  }
}

/** 依店名與品項猜分類：每組關鍵字對應幾個常見分類名稱，取使用者分類中第一個名稱相符的。 */
const CATEGORY_RULES: { keywords: RegExp; names: string[] }[] = [
  { keywords: /麥當勞|肯德基|摩斯|星巴克|路易莎|咖啡|早餐|餐廳|小吃|麵|飯|鍋|便當|飲|茶|食品|烘焙|麵包|壽司|拉麵|漢堡|披薩|Uber ?Eats|foodpanda/i, names: ['餐飲', '飲食', '食物', '吃'] },
  { keywords: /中油|台塑石油|加油|停車|捷運|高鐵|台鐵|客運|計程車|Uber|悠遊|一卡通|eTag|遠通/i, names: ['交通', '油資', '停車'] },
  { keywords: /全聯|家樂福|好市多|COSTCO|大全聯|美廉社|寶雅|屈臣氏|康是美|超市|量販|日用/i, names: ['日用品', '生活用品', '購物', '居家'] },
  { keywords: /7-?ELEVEN|統一超商|全家|萊爾富|OK超商|便利/i, names: ['餐飲', '日用品', '購物'] },
  { keywords: /藥局|診所|醫院|牙醫|眼科|藥妝/i, names: ['醫療', '醫藥', '健康'] },
  { keywords: /電信|中華電信|台灣大哥大|遠傳|台電|電力|自來水|瓦斯|欣/i, names: ['居家', '帳單', '水電', '通訊'] },
  { keywords: /影城|威秀|秀泰|KTV|錢櫃|好樂迪|遊戲|Steam|Netflix|Spotify|書店|誠品|博客來/i, names: ['娛樂', '休閒', '教育'] },
  { keywords: /IKEA|特力屋|HOLA|家具|五金|寢具/i, names: ['居家', '家居', '購物'] },
  { keywords: /UNIQLO|GU|ZARA|NET|服飾|鞋|衣/i, names: ['服飾', '衣物', '購物'] },
  { keywords: /momo|蝦皮|PChome|Yahoo|網購|電商/i, names: ['購物', '網購'] }
];

export function guessCategoryId(invoice: Pick<EInvoice, 'seller' | 'items'>, categories: Category[]): string | null {
  const expense = categories.filter((category) => category.type === 'expense');
  if (expense.length === 0) return null;
  const haystack = `${invoice.seller} ${invoice.items.join(' ')}`;
  for (const rule of CATEGORY_RULES) {
    if (!rule.keywords.test(haystack)) continue;
    for (const name of rule.names) {
      const hit = expense.find((category) => category.name.includes(name));
      if (hit) return hit.id;
    }
  }
  const fallback = expense.find((category) => /其他|購物|雜/.test(category.name));
  return (fallback ?? expense[0]).id;
}

/** 交易備註：店名，加上前兩個品項。 */
export function invoiceNote(invoice: Pick<EInvoice, 'seller' | 'items'>): string {
  const items = invoice.items.slice(0, 2).join('、');
  const note = [invoice.seller, items].filter(Boolean).join('：');
  return note.length > 60 ? `${note.slice(0, 59)}…` : note;
}
