import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

test('S3-BROWSER no cashout ends in loss and history update', async ({ page }) => {
  const login = new LoginPage(page);
  const game = new GamePage(page);
  const result = new ResultPage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  await game.selectTheme('GREEN', 9);
  await game.booster(2).click();
  await game.start().click();
  const roundId = await page.getByTestId('round-id').textContent();
  await result.expectVisible();
  await expect(game.result()).toContainText(/проигрыш|lose|loss/i);
  await game.history().click();
  await expect(page.locator(`[data-testid="history-row"][data-round-id="${roundId}"]`)).toContainText(/lose|loss/i);
});
