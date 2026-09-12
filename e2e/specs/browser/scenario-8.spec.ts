import { expect, test, type Page } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

async function win(page: Page) {
  const game = new GamePage(page);
  await game.booster(3).click();
  await game.start().click();
  const roundId = await page.getByTestId('round-id').textContent();
  expect(roundId).not.toBeNull();
  await expect(page.getByTestId('booster-marker')).toBeVisible();
  await expect(game.cashout()).toBeEnabled({ timeout: settings.eventTimeoutMs });
  await game.cashout().click();
  await expect(page.getByTestId('round-result')).toBeVisible({ timeout: settings.eventTimeoutMs });
  return { game, roundId: roundId! };
}

async function login(page: Page) {
  await new LoginPage(page).open();
  await new LoginPage(page).login(settings.username, settings.password);
  await new GamePage(page).requireGameControls();
}

test('S8-BROWSER accept updates authoritative balance/tickets and popup is once per session', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const { game } = await win(page);
  const dialog = page.getByRole('dialog', { name: /закрепить успех/i });
  await expect(dialog).toBeVisible();
  const beforePurchase = await (await page.request.get('/api/current-user/state')).json();
  const offerText = await dialog.textContent();
  const price = Number(offerText?.match(/за\s+([\d\s]+)/i)?.[1].replace(/\s/g, ''));
  const tickets = Number(offerText?.match(/купите\s+(\d+)/i)?.[1]);
  await dialog.getByRole('button', { name: /купить за/i }).click();
  await expect(dialog.getByRole('status')).toContainText(/получили/i);
  const after = await (await page.request.get('/api/current-user/state')).json();
  expect(Number(after.bonusBalance)).toBe(Number(beforePurchase.bonusBalance) - price);
  expect(Number(after.lotteryTicketCount)).toBe(Number(beforePurchase.lotteryTicketCount ?? 0) + tickets);
  await dialog.getByRole('button', { name: /продолжить/i }).click();
  await game.playAgain().click();
  await win(page);
  await expect(page.getByRole('dialog', { name: /закрепить успех/i })).toHaveCount(0);
});

test('S8-BROWSER decline mutates nothing, suppresses second WIN, and a new session may show again', async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  const { game } = await win(page);
  const firstDialog = page.getByRole('dialog', { name: /закрепить успех/i });
  await expect(firstDialog).toBeVisible();
  const beforeDecline = await (await page.request.get('/api/current-user/state')).json();
  await firstDialog.getByRole('button', { name: /нет, спасибо/i }).click();
  const afterDecline = await (await page.request.get('/api/current-user/state')).json();
  expect(Number(afterDecline.bonusBalance)).toBe(Number(beforeDecline.bonusBalance));
  expect(Number(afterDecline.lotteryTicketCount ?? 0)).toBe(Number(beforeDecline.lotteryTicketCount ?? 0));
  await game.playAgain().click();
  await win(page);
  await expect(page.getByRole('dialog', { name: /закрепить успех/i })).toHaveCount(0);

  const context = page.context();
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto('/');
  await expect(fresh.getByRole('dialog', { name: /закрепить успех/i })).toBeVisible();
});

test('S8-BROWSER LOSS never shows the offer', async ({ page }) => {
  await login(page);
  const game = new GamePage(page);
  await game.booster(1).click();
  await game.start().click();
  await expect(page.getByTestId('round-result')).toBeVisible({ timeout: settings.eventTimeoutMs });
  await expect(page.getByTestId('round-result')).toContainText(/проигрыш|lose|loss/i);
  await expect(page.getByRole('dialog', { name: /закрепить успех/i })).toHaveCount(0);
});
