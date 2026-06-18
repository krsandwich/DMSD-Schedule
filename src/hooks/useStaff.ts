import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { staffFromRow } from '@/lib/mappers';
import { roleFlags } from '@/lib/roles';
import type { Role, Staff } from '@/engine/types';

/** Active staff only — used by the calendar and monthly setup. */
export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async (): Promise<Staff[]> => {
      const { data, error } = await supabase.from('staff').select('*').eq('active', true);
      if (error) throw error;
      return (data ?? []).map(staffFromRow);
    },
  });
}

/** All staff including inactive — used by the roster management page. */
export function useAllStaff() {
  return useQuery({
    queryKey: ['staff', 'all'],
    queryFn: async (): Promise<Staff[]> => {
      const { data, error } = await supabase.from('staff').select('*');
      if (error) throw error;
      return (data ?? []).map(staffFromRow);
    },
  });
}

/** Add a staff member. Capability flags are derived from the role. */
export function useAddStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; role: Role }) => {
      const flags = roleFlags(input.role);
      const { error } = await supabase.from('staff').insert({
        name: input.name,
        display_name: input.name,
        role: input.role,
        can_pcc: flags.canPcc,
        receives_mas: flags.receivesMas,
        needs_pcc: flags.needsPcc,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

/** Activate / deactivate a staff member (deactivate = remove from future schedules). */
export function useSetStaffActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await supabase.from('staff').update({ active: input.active }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

/**
 * Permanently delete a staff member and all of their history. References from
 * other rows (MAs assigned to them, default targets) are cleared first so the
 * foreign keys don't block deletion, then their own assignments + patterns and
 * finally the staff row are removed.
 */
export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Clear references held by OTHER people's rows.
      const r1 = await supabase
        .from('daily_assignments')
        .update({ assigned_provider_id: null })
        .eq('assigned_provider_id', id);
      if (r1.error) throw r1.error;
      const r2 = await supabase
        .from('monthly_patterns')
        .update({ default_target_id: null })
        .eq('default_target_id', id);
      if (r2.error) throw r2.error;

      // Delete their own history.
      const r3 = await supabase.from('daily_assignments').delete().eq('staff_id', id);
      if (r3.error) throw r3.error;
      const r4 = await supabase.from('monthly_patterns').delete().eq('staff_id', id);
      if (r4.error) throw r4.error;

      // Finally remove the staff row itself.
      const del = await supabase.from('staff').delete().eq('id', id);
      if (del.error) throw del.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}
