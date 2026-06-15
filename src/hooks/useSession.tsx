import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppRole } from '@/lib/database.types';

interface SessionState {
  session: Session | null;
  loading: boolean;
  appRole: AppRole | null;
  isEditor: boolean;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: appRole = null } = useQuery({
    queryKey: ['app-role', session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async (): Promise<AppRole | null> => {
      const { data, error } = await supabase
        .from('app_users')
        .select('app_role')
        .eq('id', session!.user.id)
        .maybeSingle();
      if (error) throw error;
      // TEMPORARY: everyone is an editor for now (see migration 0003_all_editors.sql).
      return data?.app_role ?? 'editor';
    },
  });

  // TEMPORARY: any signed-in user is treated as an editor.
  const isEditor = !!session;

  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      appRole,
      isEditor,
      signInWithGitHub: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: window.location.origin },
        });
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, appRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
