import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey, nextMonth } from '@/lib/dates';

const KEY = ['hidden-months'] as const;

/** Set of month keys (yyyy-MM-01) the editor has hidden from the default view. */
export function useHiddenMonths() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('hidden_months').select('month');
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.month));
    },
  });
}

/** Hide (insert) or unhide (delete) a month. */
export function useSetMonthHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, hidden }: { month: Date; hidden: boolean }) => {
      const key = monthKey(month);
      if (hidden) {
        const { error } = await supabase
          .from('hidden_months')
          .upsert({ month: key }, { onConflict: 'month' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hidden_months').delete().eq('month', key);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * The editor's default landing month: the earliest non-hidden month from `from`
 * forward. Searches up to `maxAhead` months; if every month in that window is
 * hidden, falls back to `from` itself.
 */
export function upcomingNonHiddenMonth(from: Date, hidden: Set<string>, maxAhead = 24): Date {
  let m = from;
  for (let i = 0; i <= maxAhead; i++) {
    if (!hidden.has(monthKey(m))) return m;
    m = nextMonth(m);
  }
  return from;
}
