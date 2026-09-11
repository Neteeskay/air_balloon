import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

test('S2-BROWSER cashout enables after Level 1, fixes result and flight continues to crash', async ({ page }) => {
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
  await expect(game.cashout()).toBeDisabled();
  await expect(page.getByTestId('current-level')).not.toHaveText(/^(0|level\s*0|уровень\s*0)$/i, { timeout: settings.eventTimeoutMs });
  await expect(game.cashout()).toBeEnabled();
  const multiplier = await game.multiplier().textContent();
  await game.cashout().click();
  await expect(page.getByText(/могли бы забрать больше|could have taken more/i)).toBeVisible();
  await expect(game.multiplier()).not.toHaveText(multiplier ?? '', { timeout: settings.eventTimeoutMs });
  await result.expectVisible();
  await expect(page.getByTestId('potential-win')).toContainText(/могли бы забрать/i);
  await game.history().click();
  await expect(page.locator(`[data-testid="history-row"][data-round-id="${roundId}"]`)).toContainText(/win/i);
});
