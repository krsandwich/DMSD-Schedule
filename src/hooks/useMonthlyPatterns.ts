import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { patternFromRow } from '@/lib/mappers';
import { monthKey } from '@/lib/dates';
import type { MonthlyPattern } from '@/engine/types';
import type { MonthlyPatternRow } from '@/lib/database.types';

export function useMonthlyPatterns(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: ['patterns', key],
    queryFn: async (): Promise<MonthlyPattern[]> => {
      const { data, error } = await supabase
        .from('monthly_patterns')
        .select('*')
        .eq('month', key);
      if (error) throw error;
      return (data ?? []).map(patternFromRow);
    },
  });
}

/** Upsert one staff member's pattern for a month. */
export function useSavePattern(month: Date) {
  const key = monthKey(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: MonthlyPattern) => {
      const row: Omit<MonthlyPatternRow, 'id'> = {
        staff_id: pattern.staffId,
        month: key,
        usual_weekdays: pattern.usualWeekdays,
        location_by_weekday: pattern.locationByWeekday,
        requested_off_days: pattern.requestedOffDays,
      };
      const { error } = await supabase
        .from('monthly_patterns')
        .upsert(row, { onConflict: 'staff_id,month' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns', key] }),
  });
}
