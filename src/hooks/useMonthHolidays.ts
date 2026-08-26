import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey } from '@/lib/dates';

/** Holiday ISO dates for a calendar month (can include trailing spillover dates). */
export function useMonthHolidays(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: ['holidays', key],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('monthly_holidays')
        .select('dates')
        .eq('month', key)
        .maybeSingle();
      if (error) throw error;
      return data?.dates ?? [];
    },
  });
}

/** Upsert the holiday dates for a month. An empty list clears them. */
export function useSaveHolidays(month: Date) {
  const key = monthKey(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dates: string[]) => {
      const { error } = await supabase
        .from('monthly_holidays')
        .upsert({ month: key, dates }, { onConflict: 'month' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays', key] }),
  });
}
