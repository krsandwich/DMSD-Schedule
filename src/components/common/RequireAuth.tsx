import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { Spinner } from './Spinner';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
