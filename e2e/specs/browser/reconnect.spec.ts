import { expect, test, type WebSocketRoute } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';

test('BROWSER-RECONNECT UI restores the same round after a real network disconnect', async ({ page }) => {
  let activeSocket: WebSocketRoute | undefined;
  let disconnecting = false;
  await page.routeWebSocket(/\/ws\/rounds$/, socket => {
    if (disconnecting) {
      void socket.close({ code: 1012, reason: 'acceptance disconnect window' });
      return;
    }
    activeSocket = socket;
    socket.connectToServer();
  });
  const login = new LoginPage(page);
  const game = new GamePage(page);
  await login.open();
  await login.login(settings.username, settings.password);
  await game.requireGameControls();
  await game.selectTheme('GREEN', 9);
  await game.booster(2).click();
  await game.start().click();
  await expect(page.getByTestId('connection-state')).toBeVisible();
  await expect(page.getByTestId('round-id')).toBeVisible();
  await expect(game.cashout()).toBeEnabled({ timeout: settings.eventTimeoutMs });
  const previewBeforeDisconnect = await game.cashout().textContent();
  const roundId = await page.getByTestId('round-id').textContent();
  const sequenceBefore = Number(await page.getByTestId('event-sequence').textContent());
  disconnecting = true;
  await activeSocket?.close({ code: 1012, reason: 'acceptance network disconnect' });
  await expect(page.getByTestId('connection-state')).toContainText(/disconnected|offline|переподключ|нет связи|восстанавливаем/i);
  await page.waitForTimeout(1_500);
  await expect(game.cashout()).toHaveText(previewBeforeDisconnect ?? '');
  disconnecting = false;
  await expect(page.getByTestId('connection-state')).toContainText(/connected|online|подключен|на связи/i, { timeout: 15_000 });
  await expect(page.getByTestId('round-id')).toHaveText(roundId ?? '');
  await expect(game.cashout()).toContainText(/Забрать\s+[\d\s]+(?:[,.]\d+)?\s+бонусов/i);
  await expect.poll(async () => Number(await page.getByTestId('event-sequence').textContent())).toBeGreaterThan(sequenceBefore);
  await expect(game.multiplier()).toBeVisible();
});
