import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('S1-BROWSER login, balance, GREEN/RED levels, stakes, x2, rules, history and start', async ({ page }) => {
  const login = new LoginPage(page);
  const game = new GamePage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  await expect(page.getByText(/бонусный баланс|balance/i).first()).toBeVisible();
  await game.selectTheme('GREEN', 9);
  await game.selectTheme('RED', 12);
  if (!(await game.stake(settings.stake).count()) || !(await game.booster(2).count())) {
    blocked('WAITING FOR FRONTEND: stake or booster controls are not integrated');
  }
  await game.stake(settings.stake).click();
  await game.booster(2).click();
  await expect(game.rules()).toBeVisible();
  await expect(game.history()).toBeVisible();
  await expect(game.start()).toBeEnabled();
  await game.start().click();
  await expect(game.multiplier()).toBeVisible();
});
