import type { AuthResult, LoginPayload } from '../types/auth';

const DEMO_USERS = [
  { login: 'demo', password: 'demo123' },
  { login: 'demo@airballoon.ru', password: 'demo123' }
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
    ? { ok: true, message: 'Вход выполнен. Backend будет подключён позже.' }
    : { ok: false, message: 'Неверный логин или пароль' };
}
