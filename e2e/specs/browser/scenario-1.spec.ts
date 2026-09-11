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
  const options = page.getByTestId('flight-option');
  await expect(options).toHaveCount(4);
  expect(await options.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-booster')))).toEqual(['1', '2', '3', '4']);
  for (let index = 0; index < 4; index += 1) {
    expect(await options.nth(index).getAttribute('data-stake')).toMatch(/^\d+(\.\d+)?$/);
  }
  await game.booster(2).click();
  await game.rules().click();
  await expect(page.getByRole('dialog', { name: /как устроен полёт/i })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await game.history().click();
  await expect(page.getByRole('heading', { name: 'История всех игроков' })).toBeVisible();
  await page.getByRole('button', { name: /к игре/i }).click();
  await expect(game.start()).toBeEnabled();
  await game.start().click();
  await expect(game.multiplier()).toBeVisible();
  const onboarding = page.getByText('Забрать выигрыш можно после первого уровня');
  await expect(onboarding).toBeVisible();
  await expect(onboarding).toBeHidden({ timeout: 5_000 });
});
