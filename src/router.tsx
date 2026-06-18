import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/components/common/RequireAuth';
import { LoginPage } from '@/pages/LoginPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { MonthlySetupPage } from '@/pages/MonthlySetupPage';
import { RosterPage } from '@/pages/RosterPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Public, read-only schedule. Editing controls only appear once signed in.
  { path: '/', element: <SchedulePage /> },
  {
    path: '/setup',
    element: (
      <RequireAuth>
        <MonthlySetupPage />
      </RequireAuth>
    ),
  },
  {
    path: '/roster',
    element: (
      <RequireAuth>
        <RosterPage />
      </RequireAuth>
    ),
  },
]);
