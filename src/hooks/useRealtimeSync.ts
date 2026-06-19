import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSync(familyId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!familyId) return undefined;

    const channel = supabase
      .channel(`family_transactions_${familyId}`)
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
