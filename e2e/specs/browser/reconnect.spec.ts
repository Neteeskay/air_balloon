import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('BROWSER-RECONNECT UI restores the same round after a real network disconnect', async ({ page, context }) => {
  const login = new LoginPage(page);
  const game = new GamePage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  if (!(await page.getByTestId('connection-state').count()) || !(await page.getByTestId('round-id').count())) {
    blocked('WAITING FOR FRONTEND: reconnect semantic state hooks are not integrated');
  }
  await game.selectTheme('GREEN', 9);
  await game.stake(settings.stake).click();
  await game.booster(2).click();
  await game.start().click();
  const roundId = await page.getByTestId('round-id').textContent();
  const sequenceBefore = Number(await page.getByTestId('event-sequence').textContent());
  await context.setOffline(true);
  await expect(page.getByTestId('connection-state')).toContainText(/disconnected|offline|переподключ/i);
  await page.waitForTimeout(1_500);
  await context.setOffline(false);
  await expect(page.getByTestId('connection-state')).toContainText(/connected|online|подключен/i, { timeout: 15_000 });
  await expect(page.getByTestId('round-id')).toHaveText(roundId ?? '');
  await expect.poll(async () => Number(await page.getByTestId('event-sequence').textContent())).toBeGreaterThan(sequenceBefore);
  await expect(game.multiplier()).toBeVisible();
});
