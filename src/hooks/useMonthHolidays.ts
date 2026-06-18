import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey } from '@/lib/dates';

/** Holiday day-of-month numbers for a calendar month (e.g. [1, 4, 5]). */
export function useMonthHolidays(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: ['holidays', key],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from('monthly_holidays')
        .select('days')
        .eq('month', key)
        .maybeSingle();
      if (error) throw error;
      return data?.days ?? [];
    },
  });
}

/** Upsert the holiday days for a month. An empty list clears them. */
export function useSaveHolidays(month: Date) {
  const key = monthKey(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (days: number[]) => {
      const { error } = await supabase
        .from('monthly_holidays')
        .upsert({ month: key, days }, { onConflict: 'month' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays', key] }),
  });
}
