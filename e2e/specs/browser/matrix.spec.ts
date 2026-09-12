import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('BROWSER-MATRIX visible booster, live cashout and Scenario 8 render without errors', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', entry => {
    if (entry.type() !== 'error' && entry.type() !== 'warning') return;
    const isExpectedAnonymousProbe = entry.type() === 'error'
      && entry.text().includes('status of 401')
      && entry.location().url.includes('/api/auth/me');
    if (!isExpectedAnonymousProbe) browserErrors.push(entry.text());
  });
  const login = new LoginPage(page); const game = new GamePage(page);
  await login.open(); await login.login(settings.username, settings.password);
  await expect(page.getByText('● REAL API')).toBeVisible();
  await expect(page.getByRole('button', { name: /выключить звук/i })).toBeVisible();
  await expect(page.getByTestId('flight-option')).toHaveCount(4);
  await game.booster(3).click(); await game.start().click();
  await expect(page.getByTestId('active-round')).toBeVisible();
  await expect(page.getByTestId('connection-state')).toContainText(/на связи/i);
  await expect(page.getByTestId('booster-marker')).toBeVisible();
  await expect(game.cashout()).toBeEnabled({ timeout: settings.eventTimeoutMs });
  await expect(game.cashout()).toContainText(/Забрать\s+[\d\s]+(?:[,.]\d+)?\s+бонусов/i);
  await game.cashout().click();
  await expect(page.getByTestId('round-result')).toBeVisible({ timeout: settings.eventTimeoutMs });
  const offer = page.getByRole('dialog', { name: /закрепить успех/i });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: /нет, спасибо/i }).click();
  expect(browserErrors).toEqual([]);
});
