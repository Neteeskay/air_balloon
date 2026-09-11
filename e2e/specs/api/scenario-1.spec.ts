import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { decimalToScale, formatScaled } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test.describe.serial('Scenario 1 — login identity, balance, selection and start', () => {
  test('S1-API GREEN has exactly 9 real model levels and RED has exactly 12', async ({ request }) => {
    const api = new ApiClient(request, settings.authHeaders);
    await api.health();
    const users = await api.demoUsers();
    const user = users.find((item) => item.username === settings.username);
    if (!user) blocked(`Demo Login user ${settings.username} is unavailable`);
    const before = await api.userState(user!.userId);

    const green = await api.startRound('GREEN', settings.stake, settings.booster);
    expect(green.theme).toBe('GREEN');
    expect(green.totalLevels).toBe(9);
    expect(green.levelThresholds).toHaveLength(9);
    expect(green.boosterMultiplier).toBe(settings.booster);

    const afterGreen = await api.userState(user!.userId);
    expect(decimalToScale(afterGreen.bonusBalance, 2)).toBe(
      decimalToScale(before.bonusBalance, 2) - decimalToScale(settings.stake, 2)
    );

    const red = await api.startRound('RED', settings.stake, 1);
    expect(red.theme).toBe('RED');
    expect(red.totalLevels).toBe(12);
    expect(red.levelThresholds).toHaveLength(12);
    const afterRed = await api.userState(user!.userId);
    expect(decimalToScale(afterRed.bonusBalance, 2)).toBe(
      decimalToScale(afterGreen.bonusBalance, 2) - decimalToScale(settings.stake, 2)
    );
  });

  test('S1-API insufficient balance blocks a valid unavailable stake without debit', async ({ request }) => {
    const api = new ApiClient(request, settings.authHeaders);
    const users = await api.demoUsers();
    const user = users.find((item) => item.username === settings.username);
    if (!user) blocked(`Demo Login user ${settings.username} is unavailable`);
    const before = await api.userState(user!.userId);
    const stake = settings.unaffordableStake ?? formatScaled(decimalToScale(before.bonusBalance, 2) + 1n, 2);
    const response = await request.post('/api/rounds', {
      headers: settings.authHeaders,
      data: { theme: 'GREEN', betAmount: stake, boosterMultiplier: 1 }
    });
    const body = await response.json().catch(() => ({}));
    if (body.code === 'INVALID_BET' && !settings.unaffordableStake) {
      blocked('No public stake-options contract can identify a valid stake above this user balance; set ACCEPTANCE_UNAFFORDABLE_STAKE');
    }
    expect(response.status()).toBe(409);
    expect(body.code).toBe('INSUFFICIENT_BALANCE');
    const after = await api.userState(user!.userId);
    expect(decimalToScale(after.bonusBalance, 2)).toBe(decimalToScale(before.bonusBalance, 2));
  });
});
