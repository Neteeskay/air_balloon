import { expect, request as requestFactory, test } from '@playwright/test';
import { settings } from '../../helpers/env';

const emptyState = { cookies: [], origins: [] };

test('AUTH wrong password, missing/invalid session and logout enforce 401', async () => {
  const anonymous = await requestFactory.newContext({ baseURL: settings.apiUrl, storageState: emptyState });
  const wrong = await anonymous.post('/api/auth/demo-login', {
    data: { username: settings.username, password: 'definitely-wrong' }
  });
  expect(wrong.status()).toBe(401);
  expect((await wrong.json()).code).toBe('AUTH_REQUIRED');
  expect((await anonymous.get('/api/auth/me')).status()).toBe(401);

  const invalid = await requestFactory.newContext({
    baseURL: settings.apiUrl,
    storageState: emptyState,
    extraHTTPHeaders: { Cookie: 'JSESSIONID=invalid-expired-session' }
  });
  expect((await invalid.get('/api/auth/me')).status()).toBe(401);

  expect((await anonymous.post('/api/auth/demo-login', {
    data: { username: settings.username, password: settings.password }
  })).status()).toBe(200);
  expect((await anonymous.delete('/api/auth/session')).status()).toBe(204);
  expect((await anonymous.get('/api/auth/me')).status()).toBe(401);
  await invalid.dispose();
  await anonymous.dispose();
});
