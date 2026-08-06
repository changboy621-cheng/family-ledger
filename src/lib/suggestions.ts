import type { Currency, LedgerType, PaymentMethod, TransactionType } from '../types';

// 從最近交易推算「備註歷史」，全部為純函式以利測試。

export interface EntryRow {
  note: string | null;
  transaction_date?: string;
  category_id?: string | null;
  amount?: number | null;
  currency?: Currency | null;
  payment_method?: PaymentMethod | null;
}

/** 取不重複的備註，最近使用的在前（rows 假設已依日期由新到舊）。 */
export function computeRecentNotes(rows: EntryRow[], limit = 30): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];

  for (const row of rows) {
    const note = row.note?.trim();
    if (!note || seen.has(note)) continue;
    seen.add(note);
    notes.push(note);
    if (notes.length >= limit) break;
  }

  return notes;
}

/** 依目前輸入過濾備註提示；排除與輸入完全相同者。 */
export function filterNotes(notes: string[], query: string, limit = 8): string[] {
  const trimmed = query.trim();
  const matched = trimmed
    ? notes.filter((note) => note.includes(trimmed) && note !== trimmed)
    : notes;
  return matched.slice(0, limit);
}

export interface NoteDefaults {
  category_id: string | null;
  amount: number | null;
  currency: Currency | null;
  payment_method: PaymentMethod | null;
}

/** 備註 → 最近一次使用的分類/金額/幣別/付款方式（rows 新到舊，第一次出現即最新）。 */
export function buildNoteDefaults(rows: EntryRow[]): Map<string, NoteDefaults> {
  const defaults = new Map<string, NoteDefaults>();
  for (const row of rows) {
    const note = row.note?.trim();
    if (!note || defaults.has(note)) continue;
    defaults.set(note, {
      category_id: row.category_id ?? null,
      amount: row.amount ?? null,
      currency: row.currency ?? null,
      payment_method: row.payment_method ?? null
    });
  }
  return defaults;
}

/** 釘選切換：未釘選加到最前、已釘選移除。 */
export function togglePin(pinned: string[], note: string): string[] {
  return pinned.includes(note) ? pinned.filter((item) => item !== note) : [note, ...pinned];
}

/** 釘選優先的建議清單：兩邊都依輸入過濾（沿用 filterNotes 規則），釘選在前、去重、套用上限。 */
export function mergeNoteSuggestions(pinned: string[], history: string[], query: string, limit = 8): string[] {
  const pinnedMatched = filterNotes(pinned, query, limit);
  const historyMatched = filterNotes(
    history.filter((note) => !pinned.includes(note)),
    query,
    limit
  );
  return [...pinnedMatched, ...historyMatched].slice(0, limit);
}

export function pinnedNotesKey(ledgerType: LedgerType, type: TransactionType): string {
  return `fl:pinned-notes:${ledgerType}:${type}`;
}
