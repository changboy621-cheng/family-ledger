import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { flushQueue, OFFLINE_QUEUE_EVENT, OFFLINE_QUEUE_KEY, queueFor } from '../lib/offlineQueue';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

/**
 * 掛在 AppShell：回到線上（或開 App）時自動補送離線暫存的記帳，並回報待上傳筆數。
 */
export function useOfflineQueue(online: boolean) {
  const userId = useAuthStore((state) => state.profile?.id);
  const showToast = useUIStore((state) => state.showToast);
  const bumpDataVersion = useUIStore((state) => state.bumpDataVersion);
  const [pending, setPending] = useState(() => (userId ? queueFor(userId).length : 0));
  const flushing = useRef(false);
  const stuck = useRef(0);

  const recount = useCallback(() => setPending(userId ? queueFor(userId).length : 0), [userId]);

  useEffect(() => {
    recount();
    const onStorage = (event: StorageEvent) => {
      if (event.key === OFFLINE_QUEUE_KEY) recount();
    };
    window.addEventListener(OFFLINE_QUEUE_EVENT, recount);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, recount);
      window.removeEventListener('storage', onStorage);
    };
  }, [recount]);

  useEffect(() => {
    // stuck：上次補送後仍留著的資料錯誤筆數，筆數沒增加就不重試，避免重複跳錯誤提示。
    if (!online || !userId || pending <= stuck.current || flushing.current) return;
    flushing.current = true;
    void flushQueue(userId, async (row) => {
      const { error } = await supabase.from('transactions').insert(row);
      return { error };
    })
      .then(({ sent, failed }) => {
        if (sent > 0) {
          bumpDataVersion();
          showToast(`已上傳 ${sent} 筆離線記帳`);
        }
        stuck.current = failed;
        if (failed > 0) showToast(`有 ${failed} 筆離線記帳上傳失敗，請重新登入後再試`, 'error');
      })
      .catch((error) => console.error('離線記帳補送失敗', error))
      .finally(() => {
        flushing.current = false;
        recount();
      });
  }, [online, userId, pending, bumpDataVersion, showToast, recount]);

  return pending;
}
