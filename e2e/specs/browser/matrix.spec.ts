import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('BROWSER-MATRIX real login, four paired options and game start', async ({ page }) => {
  const login = new LoginPage(page); const game = new GamePage(page);
  await login.open(); await login.login(settings.username, settings.password);
  await expect(page.getByText('● REAL API')).toBeVisible();
  await expect(page.getByTestId('flight-option')).toHaveCount(4);
  await game.booster(1).click(); await game.start().click();
  await expect(page.getByTestId('active-round')).toBeVisible();
  await expect(page.getByTestId('connection-state')).toContainText(/на связи/i);
});
