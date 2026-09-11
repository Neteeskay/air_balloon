import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('S4-BROWSER x2 booster activation is rendered with multiplier and points', async ({ page }) => {
  const login = new LoginPage(page);
  const game = new GamePage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  await game.selectTheme('GREEN', 9);
  await game.booster(2).click();
  await game.start().click();
  await expect(page.getByTestId('booster-state')).toContainText(/active|активирован|×\s*2/i, { timeout: settings.eventTimeoutMs });
  await expect.poll(async () => Number((await page.getByTestId('round-points').textContent())?.replace(/\D/g, '') ?? 0)).toBeGreaterThan(0);
});
