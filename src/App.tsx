import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { SessionProvider } from '@/hooks/useSession';
import { router } from '@/router';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
