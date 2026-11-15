import { describe, expect, it } from 'vitest';
import { enqueueRow, flushQueue, isNetworkError, loadQueue, OFFLINE_QUEUE_KEY, queueFor } from './offlineQueue';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(OFFLINE_QUEUE_KEY, initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value)
  };
}

const row = (id: string, recorded_by = 'u1') => ({ id, family_id: 'f1', owner_id: recorded_by, recorded_by, amount: 100 });

describe('offlineQueue', () => {
  it('壞掉或被竄改的暫存資料視為空佇列', () => {
    expect(loadQueue(memoryStorage('not json'))).toEqual([]);
    expect(loadQueue(memoryStorage('[{"id":1}]'))).toEqual([]);
  });

  it('只回傳目前登入者的離線記帳', () => {
    const storage = memoryStorage();
    enqueueRow(row('a', 'u1'), storage);
    enqueueRow(row('b', 'u2'), storage);
    expect(queueFor('u1', storage).map((r) => r.id)).toEqual(['a']);
  });

  it('補送成功或主鍵重複都會移出佇列', async () => {
    const storage = memoryStorage();
    enqueueRow(row('a'), storage);
    enqueueRow(row('b'), storage);
    const result = await flushQueue(
      'u1',
      async (r) => ({ error: r.id === 'b' ? { code: '23505' } : null }),
      storage
    );
    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(loadQueue(storage)).toEqual([]);
  });

  it('遇到網路錯誤就停止，未送的留在佇列', async () => {
    const storage = memoryStorage();
    enqueueRow(row('a'), storage);
    enqueueRow(row('b'), storage);
    let calls = 0;
    const result = await flushQueue(
      'u1',
      async () => {
        calls += 1;
        return { error: calls === 1 ? null : new TypeError('Failed to fetch') };
      },
      storage
    );
    expect(result.sent).toBe(1);
    expect(loadQueue(storage).map((r) => r.id)).toEqual(['b']);
  });

  it('資料錯誤會保留該筆並繼續送後面的', async () => {
    const storage = memoryStorage();
    enqueueRow(row('a'), storage);
    enqueueRow(row('b'), storage);
    const result = await flushQueue(
      'u1',
      async (r) => ({ error: r.id === 'a' ? { code: '42501', message: 'row-level security policy' } : null }),
      storage
    );
    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(loadQueue(storage).map((r) => r.id)).toEqual(['a']);
  });

  it('辨識網路錯誤', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'row-level security policy' })).toBe(false);
  });
});
