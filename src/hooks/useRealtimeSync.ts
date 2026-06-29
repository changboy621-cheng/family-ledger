import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSync(familyId: string | undefined, onChange: () => void) {
  const channelKeyRef = useRef(`rt_${Math.random().toString(36).slice(2, 10)}`);
  // 用 ref 持有最新 onChange，讓 channel 訂閱不因 callback 身分變動（如換月時 loadTransactions 重建）而拆/重建。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!familyId) return undefined;

    const channel = supabase
      .channel(`family_transactions_${familyId}_${channelKeyRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `family_id=eq.${familyId}&ledger_type=eq.family`
        },
        () => onChangeRef.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId]);
}
