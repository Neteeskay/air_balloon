import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../features/admin/auth/ProtectedRoute';
import { AdminLayout } from '../features/admin/components/AdminLayout';
import { AuditPage } from '../features/admin/pages/AuditPage';
import { ConfigPage } from '../features/admin/pages/ConfigPage';
import { DashboardPage } from '../features/admin/pages/DashboardPage';
import { ForbiddenPage } from '../features/admin/pages/ForbiddenPage';
import { LoginPage } from '../features/admin/pages/LoginPage';
import { NotFoundPage } from '../features/admin/pages/NotFoundPage';
import { VersionDetailPage } from '../features/admin/pages/VersionDetailPage';
import { VersionsPage } from '../features/admin/pages/VersionsPage';
import { LandingPage } from '../features/landing/pages/LandingPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/admin/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'config', element: <ConfigPage /> },
          { path: 'versions', element: <VersionsPage /> },
          { path: 'versions/:id', element: <VersionDetailPage /> },
          { path: 'audit', element: <AuditPage /> },
          { path: 'forbidden', element: <ForbiddenPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
