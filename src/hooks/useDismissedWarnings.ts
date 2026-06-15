import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey, monthRange } from '@/lib/dates';
import type { Warning } from '@/engine/types';

export function dismissalKey(date: string, type: string, refKey: string): string {
  return `${date}|${type}|${refKey}`;
}

export function warningKey(w: Warning): string {
  return dismissalKey(w.date, w.type, w.refKey);
}

export function useDismissedWarnings(month: Date) {
  const { start, end } = monthRange(month);
  return useQuery({
    queryKey: ['dismissed', monthKey(month)],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('dismissed_warnings')
        .select('*')
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      return new Set((data ?? []).map((r) => dismissalKey(r.date, r.type, r.ref_key)));
    },
  });
}

export function useDismissWarning(month: Date) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: Warning) => {
      const { error } = await supabase
        .from('dismissed_warnings')
        .upsert({ date: w.date, type: w.type, ref_key: w.refKey });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dismissed', monthKey(month)] }),
  });
}
