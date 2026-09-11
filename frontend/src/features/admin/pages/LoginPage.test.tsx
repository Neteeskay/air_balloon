import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../../test/server';
import { AuthProvider } from '../auth/AuthProvider';
import { LoginPage } from './LoginPage';

function renderLogin() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <Routes>
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin" element={<div>dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('logs in and redirects to admin', async () => {
    server.use(
      http.post('http://localhost:8080/api/admin/auth/login', async ({ request }) => {
        const body = (await request.json()) as { username: string; password: string };
        expect(body).toEqual({ username: 'admin', password: 'admin' });
        return HttpResponse.json({ accessToken: 'token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z' });
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Имя пользователя'), 'admin');
    await user.type(screen.getByLabelText('Пароль'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  it('shows INVALID_CREDENTIALS without exposing raw HTTP text', async () => {
    server.use(
      http.post('http://localhost:8080/api/admin/auth/login', () =>
        HttpResponse.json({ status: 401, code: 'INVALID_CREDENTIALS', message: 'raw backend text' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Имя пользователя'), 'admin');
    await user.type(screen.getByLabelText('Пароль'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверное имя пользователя или пароль.')).toBeInTheDocument();
    expect(screen.queryByText('raw backend text')).not.toBeInTheDocument();
  });
});
