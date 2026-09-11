import { expect, test, type WebSocketRoute } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

test('TOURNAMENT REST, STOMP, top-3, current player, timer, live score and reconnect', async ({ page, browser }) => {
  let tournamentSocket: WebSocketRoute | undefined; let disconnecting = false;
  await page.routeWebSocket(url => url.pathname === '/ws', socket => {
    if (disconnecting) { void socket.close({ code: 1012, reason: 'acceptance tournament disconnect' }); return; }
    tournamentSocket = socket; socket.connectToServer();
  });
  const login = new LoginPage(page);
  await login.open(); await login.login(settings.username, settings.password);
  await page.getByRole('button', { name: 'Турнир' }).click();
  await expect(page.getByRole('heading', { name: 'Топ-3' })).toBeVisible();
  await expect(page.locator('.leaderboard > div')).toHaveCount(3);
  await expect(page.locator('.current-player')).toBeVisible();
  await expect(page.getByText(/осталось \d+:\d{2}/i)).toBeVisible();
  await expect(page.getByText(/таблица обновляется в реальном времени/i)).toBeVisible();
  const beforeScore = digits(await page.locator('.current-player b').textContent());
  const beforeRevision = revision(await page.locator('.tournament-card .muted').textContent());

  disconnecting = true;
  await tournamentSocket?.close({ code: 1012, reason: 'acceptance tournament disconnect' });
  await expect(page.getByText(/восстанавливаем таблицу/i)).toBeVisible();
  await page.waitForTimeout(1_500); disconnecting = false;
  await expect(page.getByText(/таблица обновляется в реальном времени/i)).toBeVisible({ timeout: 15_000 });

  const scorerContext = await browser.newContext({ baseURL: settings.frontendUrl, storageState: { cookies: [], origins: [] } });
  const scorer = await scorerContext.newPage(); const scorerLogin = new LoginPage(scorer); const game = new GamePage(scorer); const result = new ResultPage(scorer);
  await scorerLogin.open(); await scorerLogin.login(settings.username, settings.password);
  await game.booster(1).click(); await game.start().click(); await result.expectVisible();
  await expect.poll(async () => revision(await page.locator('.tournament-card .muted').textContent()), { timeout: 15_000 }).toBeGreaterThan(beforeRevision);
  await expect.poll(async () => digits(await page.locator('.current-player b').textContent()), { timeout: 15_000 }).toBeGreaterThan(beforeScore);
  await scorerContext.close();
});

function digits(value: string | null) { return Number((value ?? '').replace(/\D/g, '')); }
function revision(value: string | null) { return Number(/revision\s+(\d+)/i.exec(value ?? '')?.[1] ?? 0); }
