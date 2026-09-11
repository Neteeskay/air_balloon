import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { LoginPage } from '../../pages/login.page';

test('AUTH-BROWSER logout and a backend 401 return to login without an endless loader', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('button', { name: /войти/i })).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);

  await login.login(settings.username, settings.password);
  expect((await page.request.delete('/api/auth/session')).status()).toBe(204);
  await page.reload();
  await expect(page.getByRole('button', { name: /войти/i })).toBeVisible();
  await expect(page.getByRole('status', { name: /загружаем/i })).toHaveCount(0);
});
