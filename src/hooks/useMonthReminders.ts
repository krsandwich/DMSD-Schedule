import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey } from '@/lib/dates';

/** Special Reminders free text for a calendar month (raw, unparsed). */
export function useMonthReminders(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: ['reminders', key],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('monthly_reminders')
        .select('text')
        .eq('month', key)
        .maybeSingle();
      if (error) throw error;
      return data?.text ?? '';
    },
  });
}

/** Upsert the reminders text for a month. Deliberately month-specific — never
 * carried forward by "Copy last month". */
export function useSaveReminders(month: Date) {
  const key = monthKey(month);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from('monthly_reminders')
        .upsert({ month: key, text }, { onConflict: 'month' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders', key] }),
  });
}
