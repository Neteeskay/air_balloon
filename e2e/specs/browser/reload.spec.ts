import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('PAGE-RELOAD localStorage roundId restores the same active server round', async ({ page }) => {
  const login = new LoginPage(page); const game = new GamePage(page);
  await login.open(); await login.login(settings.username, settings.password);
  await game.selectTheme('GREEN', 9); await game.booster(2).click(); await game.start().click();
  await expect(game.cashout()).toBeEnabled({ timeout: settings.eventTimeoutMs });
  await expect(game.cashout()).toContainText(/Забрать\s+[\d\s]+(?:[,.]\d+)?\s+бонусов/i);
  const roundId = (await page.getByTestId('round-id').textContent())!;
  const sequence = Number(await page.getByTestId('event-sequence').textContent());
  expect(await page.evaluate(id => Object.values(localStorage).includes(id), roundId)).toBe(true);
  await page.reload();
  await expect(page.getByTestId('round-id')).toHaveText(roundId, { timeout: 15_000 });
  await expect(page.getByTestId('connection-state')).toContainText(/на связи/i);
  await expect(game.cashout()).toContainText(/Забрать\s+[\d\s]+(?:[,.]\d+)?\s+бонусов/i);
  await expect.poll(async () => Number(await page.getByTestId('event-sequence').textContent())).toBeGreaterThanOrEqual(sequence);
});
