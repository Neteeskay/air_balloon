import { expect, request as requestFactory, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test.describe.serial('Scenario 1 — login identity, balance, selection and start', () => {
  test('S1-API GREEN has exactly 9 real model levels and RED has exactly 12', async ({ request }) => {
    const api = new ApiClient(request, settings.authHeaders);
    await api.health();
    const before = await api.currentState();
    const catalog = await api.catalog();
    expect(catalog.themes).toEqual(expect.arrayContaining([
      expect.objectContaining({ theme: 'GREEN', levels: 9, active: true }),
      expect.objectContaining({ theme: 'RED', levels: 12, active: true })
    ]));
    expect(catalog.boosters.filter((item: any) => item.active).map((item: any) => item.multiplier)).toEqual([1, 2, 3, 4]);

    const startKey = randomUUID();
    const green = await api.startRound('GREEN', settings.stake, settings.booster, startKey);
    expect((await api.startRound('GREEN', settings.stake, settings.booster, startKey)).id).toBe(green.id);
    expect(green.theme).toBe('GREEN');
    expect(green.totalLevels).toBe(9);
    expect(green.levelThresholds).toHaveLength(9);
    expect(green.boosterMultiplier).toBe(settings.booster);

    const afterGreen = await api.currentState();
    expect(decimalToScale(afterGreen.bonusBalance, 2)).toBe(
      decimalToScale(before.bonusBalance, 2) - decimalToScale(green.betAmount, 2)
    );

    const red = await api.startRound('RED', settings.stake, 1);
    expect(red.theme).toBe('RED');
    expect(red.totalLevels).toBe(12);
    expect(red.levelThresholds).toHaveLength(12);
    const afterRed = await api.currentState();
    expect(decimalToScale(afterRed.bonusBalance, 2)).toBe(
      decimalToScale(afterGreen.bonusBalance, 2) - decimalToScale(red.betAmount, 2)
    );
  });

  test('S1-API missing session rejects start without creating a round', async () => {
    const anonymous = await requestFactory.newContext({
      baseURL: settings.apiUrl,
      storageState: { cookies: [], origins: [] }
    });
    const beforeHistory = await anonymous.get('/api/history?size=100');
    expect(beforeHistory.status()).toBe(401);
    const response = await anonymous.post('/api/rounds', { data: { theme: 'GREEN', betAmount: settings.stake, boosterMultiplier: 1 } });
    expect(response.status()).toBe(401); expect((await response.json()).code).toBe('AUTH_REQUIRED');
    expect((await (await anonymous.get('/api/history?size=100')).json()).code).toBe('AUTH_REQUIRED');
    await anonymous.dispose();
  });
});
