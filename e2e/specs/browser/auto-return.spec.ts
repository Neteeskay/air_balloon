import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

test('AUTO-RETURN result returns once after 10 seconds and preserves RED', async ({ page }) => {
  const login = new LoginPage(page); const game = new GamePage(page); const result = new ResultPage(page);
  await login.open(); await login.login(settings.username, settings.password);
  await game.selectTheme('RED', 12);
  await game.booster(1).click();
  await game.start().click();
  await result.expectVisible();
  await page.waitForTimeout(9_000);
  await expect(game.result()).toBeVisible();
  await expect(game.start()).toBeVisible({ timeout: 3_000 });
  await game.assertThemeSelected('RED');
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId('flight-option')).toHaveCount(4);
});
