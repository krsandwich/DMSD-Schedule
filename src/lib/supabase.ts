import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev rather than producing confusing 401s later.
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
  );
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '');
