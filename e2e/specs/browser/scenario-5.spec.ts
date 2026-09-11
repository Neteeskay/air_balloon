import { test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

test('S5-BROWSER result, Play Again and selected RED theme persistence', async ({ page }) => {
  const login = new LoginPage(page);
  const game = new GamePage(page);
  const result = new ResultPage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  await game.selectTheme('RED', 12);
  await game.stake(settings.stake).click();
  await game.booster(2).click();
  await game.start().click();
  await result.expectVisible();
  await game.playAgain().click();
  await game.assertThemeSelected('RED');
  await game.selectTheme('RED', 12);
});
