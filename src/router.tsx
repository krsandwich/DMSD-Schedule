import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/components/common/RequireAuth';
import { LoginPage } from '@/pages/LoginPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { MonthlySetupPage } from '@/pages/MonthlySetupPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <SchedulePage />
      </RequireAuth>
    ),
  },
  {
    path: '/setup',
    element: (
      <RequireAuth>
        <MonthlySetupPage />
      </RequireAuth>
    ),
  },
]);
