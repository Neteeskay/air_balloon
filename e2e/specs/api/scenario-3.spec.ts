import { expect, test } from '@playwright/test';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('S3-API crash without cashout loses stake and updates result/history', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const user = (await api.demoUsers()).find((item) => item.username === settings.username);
  if (!user) blocked(`Demo Login user ${settings.username} is unavailable`);
  const initial = await api.userState(user!.userId);
  const round = await api.startRound('GREEN', settings.stake, settings.booster);
  const final = await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
  expect(final.outcome).toBe('LOSS');
  expect(final.cashoutPerformed).toBe(false);
  expect(decimalToScale(final.winAmount, 2)).toBe(0n);
  const current = await api.userState(user!.userId);
  expect(decimalToScale(current.bonusBalance, 2)).toBe(
    decimalToScale(initial.bonusBalance, 2) - decimalToScale(settings.stake, 2)
  );
  const result = await api.result(round.id);
  expect(result.result).toBe('LOSS');
  expect(decimalToScale(result.winAmount, 2)).toBe(0n);
  expect(historyItems(await api.history()).some((item) => item.roundId === round.id && item.result === 'LOSS')).toBe(true);
});
