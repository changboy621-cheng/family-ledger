import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSync(familyId: string | undefined, onChange: () => void) {
  const channelKeyRef = useRef(`rt_${Math.random().toString(36).slice(2, 10)}`);

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
        () => onChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId, onChange]);
}
