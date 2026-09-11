import { expect, test } from '@playwright/test';
import { settings } from '../../helpers/env';
import { GamePage } from '../../pages/game.page';
import { LoginPage } from '../../pages/login.page';
import { ResultPage } from '../../pages/result.page';

test('RELIABILITY-BROWSER 20 sequential real rounds reuse one game WebSocket and remain responsive', async ({ page, request }) => {
  test.setTimeout(180_000);
  const currentResponse = await request.get(`${settings.apiUrl}/api/admin/config`, {
    headers: { 'X-Admin-Token': settings.adminToken }
  });
  expect(currentResponse.status(), await currentResponse.text()).toBe(200);
  const original = await currentResponse.json();
  const fastResponse = await request.put(`${settings.apiUrl}/api/admin/config`, {
    headers: { 'X-Admin-Token': settings.adminToken },
    data: {
      expectedVersion: original.version,
      config: {
        ...original.config,
        minCrashMultiplier: 1.2,
        maxCrashMultiplier: 1.2,
        growthRate: 10,
        updateIntervalMs: 16
      }
    }
  });
  expect(fastResponse.status(), await fastResponse.text()).toBe(200);

  const sockets: string[] = [];
  const pageErrors: string[] = [];
  page.on('websocket', socket => sockets.push(socket.url()));
  page.on('pageerror', error => pageErrors.push(error.message));
  const login = new LoginPage(page);
  const game = new GamePage(page);
  const result = new ResultPage(page);

  try {
    await login.open();
    await login.login(settings.username, settings.password);
    await game.requireGameControls();
    await game.selectTheme('GREEN', 9);
    await game.booster(1).click();

    for (let index = 0; index < 20; index += 1) {
      await game.start().click();
      await result.expectVisible();
      if (index < 19) {
        await game.playAgain().click();
        await expect(game.start()).toBeEnabled();
      }
    }

    expect(pageErrors).toEqual([]);
    expect(sockets.filter(url => /\/ws\/rounds(?:\?|$)/.test(url))).toHaveLength(1);
    await expect(game.playAgain()).toBeVisible();
  } finally {
    const latestResponse = await request.get(`${settings.apiUrl}/api/admin/config`, {
      headers: { 'X-Admin-Token': settings.adminToken }
    });
    if (latestResponse.ok()) {
      const latest = await latestResponse.json();
      await request.put(`${settings.apiUrl}/api/admin/config`, {
        headers: { 'X-Admin-Token': settings.adminToken },
        data: { expectedVersion: latest.version, config: original.config }
      });
    }
  }
});
