import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { monthKey } from '@/lib/dates';

const KEY = ['published-months'] as const;

/** Set of month keys (yyyy-MM-01) that are published for viewers. */
export function usePublishedMonths() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('published_months').select('month');
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.month));
    },
  });
}

/** Publish (insert) or unpublish (delete) a month. */
export function useSetMonthPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, published }: { month: Date; published: boolean }) => {
      const key = monthKey(month);
      if (published) {
        const { error } = await supabase
          .from('published_months')
          .upsert({ month: key }, { onConflict: 'month' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('published_months').delete().eq('month', key);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
