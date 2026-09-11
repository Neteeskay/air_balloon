import type { AuthResult, CurrentUser, LoginPayload } from '../types/auth';

const DEMO_USERS = [
  {
    login: 'demo',
    password: 'demo123',
    user: {
      userId: '00000000-0000-4000-8000-000000000001',
      displayName: 'Игрок Demo'
    }
  },
  {
    login: 'demo@airballoon.ru',
    password: 'demo123',
    user: {
      userId: '00000000-0000-4000-8000-000000000002',
      displayName: 'Игрок Air Balloon'
    }
  }
];

export async function mockLogin(payload: LoginPayload): Promise<AuthResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 450));

  if (!payload.login.trim() || !payload.password) {
    return { ok: false, message: 'Введите логин и пароль' };
  }

  const user = DEMO_USERS.find(
    (item) => item.login.toLowerCase() === payload.login.trim().toLowerCase() && item.password === payload.password
  );

  return user
    ? { ok: true, message: 'Вход выполнен.', user: user.user satisfies CurrentUser }
    : { ok: false, message: 'Неверный логин или пароль' };
}
