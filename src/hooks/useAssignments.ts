import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { assignmentFromRow, assignmentToRow } from '@/lib/mappers';
import { monthKey, monthRange } from '@/lib/dates';
import type { Assignment } from '@/engine/types';

export function assignmentsKey(month: Date) {
  return ['assignments', monthKey(month)] as const;
}

export function useAssignments(month: Date) {
  const { start, end } = monthRange(month);
  return useQuery({
    queryKey: assignmentsKey(month),
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await supabase
        .from('daily_assignments')
        .select('*')
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      return (data ?? []).map(assignmentFromRow);
    },
  });
}

/** Replace the whole month's assignments (used by Generate). */
export function useReplaceMonth(month: Date) {
  const { start, end } = monthRange(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: Assignment[]) => {
      const del = await supabase
        .from('daily_assignments')
        .delete()
        .gte('date', start)
        .lte('date', end);
      if (del.error) throw del.error;
      // Persist only people who are actually present (one row per working day).
      const rows = assignments.filter((a) => a.location !== 'off').map(assignmentToRow);
      if (rows.length) {
        const ins = await supabase.from('daily_assignments').insert(rows);
        if (ins.error) throw ins.error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(month) }),
  });
}

/**
 * Regenerate ONE person's assignments for the month, leaving everyone else's rows
 * untouched. Deletes only this staff member's rows in the month range, then inserts
 * their freshly generated working days. Used by the per-person "Generate" button in
 * monthly setup so adding a new hire (or re-running one person) never clears the
 * whole schedule the way {@link useReplaceMonth} does.
 */
export function useReplacePersonMonth(month: Date) {
  const { start, end } = monthRange(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      staffId,
      assignments,
    }: {
      staffId: string;
      assignments: Assignment[];
    }) => {
      const del = await supabase
        .from('daily_assignments')
        .delete()
        .eq('staff_id', staffId)
        .gte('date', start)
        .lte('date', end);
      if (del.error) throw del.error;
      // Only this person's working days (off staff carry no row).
      const rows = assignments
        .filter((a) => a.staffId === staffId && a.location !== 'off')
        .map(assignmentToRow);
      if (rows.length) {
        const ins = await supabase.from('daily_assignments').insert(rows);
        if (ins.error) throw ins.error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(month) }),
  });
}

/**
 * Replace ONE date's assignments across ALL staff, leaving every other day in
 * the month untouched. Used when a Monthly Setup holiday edit takes effect: a
 * newly-added holiday clears that day (pass `assignments: []`); a
 * newly-removed holiday fills it back in (pass the freshly generated day).
 */
export function useReplaceDayAssignments(month: Date) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, assignments }: { date: string; assignments: Assignment[] }) => {
      const del = await supabase.from('daily_assignments').delete().eq('date', date);
      if (del.error) throw del.error;
      const rows = assignments.filter((a) => a.location !== 'off').map(assignmentToRow);
      if (rows.length) {
        const ins = await supabase.from('daily_assignments').insert(rows);
        if (ins.error) throw ins.error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(month) }),
  });
}

/** Upsert a single assignment (used after a drag-drop or toggle edit). */
export function useUpsertAssignment(month: Date) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Assignment) => {
      const { error } = await supabase
        .from('daily_assignments')
        .upsert(assignmentToRow(a), { onConflict: 'date,staff_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(month) }),
  });
}
