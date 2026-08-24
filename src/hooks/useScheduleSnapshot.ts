import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey } from '@/lib/dates';
import type { Assignment } from '@/engine/types';

export interface ScheduleSnapshot {
  /** ISO timestamp of when the snapshot was captured. */
  takenAt: string;
  /** The month's daily assignments as they were just before "Generate month". */
  rows: Assignment[];
}

export function snapshotKey(month: Date) {
  return ['schedule-snapshot', monthKey(month)] as const;
}

/** The most recent pre-generate snapshot for a month (null if none). */
export function useScheduleSnapshot(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: snapshotKey(month),
    queryFn: async (): Promise<ScheduleSnapshot | null> => {
      const { data, error } = await supabase
        .from('schedule_snapshots')
        .select('taken_at, rows')
        .eq('month', key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { takenAt: data.taken_at, rows: data.rows ?? [] };
    },
  });
}

/**
 * Save (overwrite) the month's snapshot with the given assignments. Called right
 * before "Generate month" replaces the schedule, so the prior state — including
 * manual edits — can be restored.
 */
export function useSaveSnapshot(month: Date) {
  const key = monthKey(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Assignment[]) => {
      const { error } = await supabase
        .from('schedule_snapshots')
        .upsert({ month: key, taken_at: new Date().toISOString(), rows }, { onConflict: 'month' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: snapshotKey(month) }),
  });
}
