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
  await game.stake(settings.stake).click();
  await game.booster(2).click();
  await game.start().click();
  await result.expectVisible();
  await expect(game.result()).toContainText(/проигрыш|lose|loss/i);
  await expect(game.history()).toContainText(/проигрыш|lose|loss/i);
});
