import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('S4-BROWSER x2 booster activation is rendered with multiplier and points', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __airBalloonAudioStarts?: number }).__airBalloonAudioStarts = 0;
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: unknown[]) {
      const target = window as Window & { __airBalloonAudioStarts?: number };
      target.__airBalloonAudioStarts = (target.__airBalloonAudioStarts ?? 0) + 1;
      return (original as (...values: unknown[]) => void).apply(this, args);
    };
  });
  const login = new LoginPage(page);
  const game = new GamePage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  await game.selectTheme('GREEN', 9);
  await game.booster(2).click();
  await game.start().click();
  await expect(game.cashout()).toBeEnabled({ timeout: settings.eventTimeoutMs });
  const before = await game.cashout().textContent();
  await expect(page.getByTestId('booster-state')).toContainText(/active|активирован/i, { timeout: settings.eventTimeoutMs });
  await expect(game.cashout()).not.toHaveText(before ?? '', { timeout: settings.eventTimeoutMs });
  await expect(game.cashout()).toContainText(/Забрать\s+[\d\s]+(?:[,.]\d+)?\s+бонусов/i);
  await expect.poll(async () => Number((await page.getByTestId('round-points').textContent())?.replace(/\D/g, '') ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as Window & { __airBalloonAudioStarts?: number }).__airBalloonAudioStarts ?? 0)).toBeGreaterThan(1);
  await page.getByRole('button', { name: /выключить звук/i }).click();
  await expect(page.getByRole('button', { name: /включить звук/i })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('air-balloon-sound-muted'))).toBe('true');
});
