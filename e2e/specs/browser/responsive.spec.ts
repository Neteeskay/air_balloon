import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

const sizes = [
  { width: 320, height: 568 }, { width: 375, height: 812 }, { width: 768, height: 1024 },
  { width: 1440, height: 900 }, { width: 1920, height: 1080 }
];

test('RESPONSIVE setup, dialogs, cashout, result, history and profile have no horizontal overflow', async ({ page }) => {
  const login = new LoginPage(page); const game = new GamePage(page); const result = new ResultPage(page);
  await login.open(); await login.login(settings.username, settings.password);
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(page.getByTestId('flight-option')).toHaveCount(4);
    await expect(page.getByRole('complementary', { name: /профиль/i })).toBeVisible();
    await expectNoOverflow(page);
  }
  await game.rules().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await game.booster(1).click(); await game.start().click();
  await expect(game.cashout()).toBeVisible();
  for (const size of sizes) { await page.setViewportSize(size); await expect(game.cashout()).toBeVisible(); await expectNoOverflow(page); }
  await result.expectVisible();
  for (const size of sizes) { await page.setViewportSize(size); await expect(game.result()).toBeVisible(); await expectNoOverflow(page); }
  await game.history().click();
  for (const size of sizes) { await page.setViewportSize(size); await expect(page.getByRole('heading', { name: /история всех игроков/i })).toBeVisible(); await expectNoOverflow(page); }
});

async function expectNoOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
