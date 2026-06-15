import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { assignmentsKey } from './useAssignments';

/**
 * Live updates: Viewers see Editor changes to daily_assignments without
 * refreshing. Invalidates the month's assignment query on any change.
 */
export function useRealtime(month: Date) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('daily_assignments_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_assignments' },
        () => qc.invalidateQueries({ queryKey: assignmentsKey(month) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, month]);
}
