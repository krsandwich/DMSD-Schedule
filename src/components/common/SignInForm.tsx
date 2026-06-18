import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { Button } from './Button';

/** Username + password sign-in for the single editor account. */
export function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
  const { signInWithCredentials } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      await signInWithCredentials(username, password);
      onSuccess?.();
    } catch {
      setError('Incorrect username or password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col text-xs font-medium text-gray-600">
        Username
        <input
          className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          value={username}
          autoFocus
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="flex flex-col text-xs font-medium text-gray-600">
        Password
        <input
          type="password"
          className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !username.trim() || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
