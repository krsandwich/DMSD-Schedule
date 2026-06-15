import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { staffFromRow } from '@/lib/mappers';
import type { Staff } from '@/engine/types';

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
