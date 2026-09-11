import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { setAuthSession } from '../../../services/authSession';

function renderRoute() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/config']}>
          <Routes>
            <Route path="/admin/login" element={<div>login target</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/admin/config" element={<div>protected content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users', () => {
    renderRoute();
    expect(screen.getByText('login target')).toBeInTheDocument();
  });

  it('renders protected content for a valid session', () => {
    setAuthSession({ accessToken: 'token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z' });
    renderRoute();
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
