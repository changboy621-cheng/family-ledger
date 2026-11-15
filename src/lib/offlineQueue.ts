import { z } from 'zod';

/**
 * 離線記帳佇列：沒網路時把「已組好、可直接 insert」的交易列暫存在本機，
 * 連線後再補送。每筆帶用戶端產生的 id，重送時若伺服器已收過（主鍵重複）就視為成功，
 * 避免「其實已送達、只是回應遺失」造成重複記帳。
 */
export const OFFLINE_QUEUE_KEY = 'familyLedger.offlineTransactions';
export const OFFLINE_QUEUE_EVENT = 'family-ledger:offline-queue';

const queuedRowSchema = z
  .object({
    id: z.string().min(1),
    family_id: z.string().min(1),
    owner_id: z.string().min(1),
    recorded_by: z.string().min(1)
  })
  .passthrough();

export type QueuedRow = z.infer<typeof queuedRowSchema>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadQueue(storage: StorageLike | null = defaultStorage()): QueuedRow[] {
  if (!storage) return [];
  try {
    const parsed = z.array(queuedRowSchema).safeParse(JSON.parse(storage.getItem(OFFLINE_QUEUE_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function saveQueue(rows: QueuedRow[], storage: StorageLike | null) {
  if (!storage) throw new Error('此裝置無法暫存離線記帳。');
  storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(rows));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

export function enqueueRow(row: QueuedRow, storage: StorageLike | null = defaultStorage()) {
  saveQueue([...loadQueue(storage), row], storage);
}

export function removeRows(ids: string[], storage: StorageLike | null = defaultStorage()) {
  const drop = new Set(ids);
  saveQueue(
    loadQueue(storage).filter((row) => !drop.has(row.id)),
    storage
  );
}

/** 只回傳屬於目前登入者的佇列（換帳號登入時不會誤送別人的離線記帳）。 */
export function queueFor(userId: string, storage: StorageLike | null = defaultStorage()) {
  return loadQueue(storage).filter((row) => row.recorded_by === userId);
}

/** 判斷是否為「網路不通」類錯誤（值得暫存重送），而非資料／權限錯誤。 */
export function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message ?? '';
  return /Failed to fetch|NetworkError|Load failed|network request failed/i.test(message);
}

/** 主鍵重複＝伺服器其實已收過這筆。 */
export function isDuplicateKey(error: unknown) {
  return (error as { code?: string } | null)?.code === '23505';
}

export function newClientId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

type InsertFn = (row: QueuedRow) => Promise<{ error: unknown }>;

/** 依序補送目前使用者的離線記帳；回傳成功送出的筆數。遇到網路錯誤就停，留待下次。 */
export async function flushQueue(userId: string, insert: InsertFn, storage: StorageLike | null = defaultStorage()) {
  const sent: string[] = [];
  let failed = 0;
  for (const row of queueFor(userId, storage)) {
    const { error } = await insert(row);
    if (!error || isDuplicateKey(error)) {
      sent.push(row.id);
      continue;
    }
    if (isNetworkError(error)) break;
    // 資料或權限錯誤重送也不會成功：保留在佇列，交由使用者處理。
    failed += 1;
  }
  if (sent.length > 0) removeRows(sent, storage);
  return { sent: sent.length, failed };
}
