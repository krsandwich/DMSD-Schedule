import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { SignInForm } from '@/components/common/SignInForm';
import { Spinner } from '@/components/common/Spinner';

export function LoginPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  if (session) return <Navigate to="/" replace />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">DMSD Scheduler</h1>
        <p className="mt-1 text-sm text-gray-500">Dermatology office staffing calendar</p>
      </div>
      <div className="w-72 rounded-lg border border-gray-200 p-5 shadow-sm">
        <SignInForm onSuccess={() => navigate('/')} />
      </div>
    </div>
  );
}
