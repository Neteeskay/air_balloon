import { expect, test } from '@playwright/test';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('MULTI-USER two authenticated identities keep balances and histories isolated', async ({ request }) => {
  if (!Object.keys(settings.authHeaders).length || !Object.keys(settings.secondAuthHeaders).length) {
    blocked('Current-user identity contract is not published; set distinct ACCEPTANCE_AUTH_HEADERS and ACCEPTANCE_SECOND_AUTH_HEADERS after Core integration');
  }
  if (JSON.stringify(settings.authHeaders) === JSON.stringify(settings.secondAuthHeaders)) {
    blocked('Two distinct authenticated identities are required');
  }
  const apiA = new ApiClient(request, settings.authHeaders);
  const apiB = new ApiClient(request, settings.secondAuthHeaders);
  await apiA.health();
  const users = await apiA.demoUsers();
  const userA = users.find((item) => item.username === settings.username);
  const userB = users.find((item) => item.username === settings.secondUsername);
  if (!userA || !userB) blocked('Configured demo users are unavailable');
  expect(userA!.userId).not.toBe(userB!.userId);
  const beforeA = await apiA.userState(userA!.userId);
  const beforeB = await apiB.userState(userB!.userId);
  const roundA = await apiA.startRound('GREEN', settings.stake, 2);
  const roundB = await apiB.startRound('RED', settings.stake, 2);
  const afterA = await apiA.userState(userA!.userId);
  const afterB = await apiB.userState(userB!.userId);
  expect(decimalToScale(afterA.bonusBalance, 2)).toBe(decimalToScale(beforeA.bonusBalance, 2) - decimalToScale(settings.stake, 2));
  expect(decimalToScale(afterB.bonusBalance, 2)).toBe(decimalToScale(beforeB.bonusBalance, 2) - decimalToScale(settings.stake, 2));
  await Promise.all([
    apiA.waitForSnapshot(roundA.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs),
    apiB.waitForSnapshot(roundB.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs)
  ]);
  const historyA = historyItems(await apiA.history());
  const historyB = historyItems(await apiB.history());
  expect(historyA.some((item) => item.roundId === roundA.id)).toBe(true);
  expect(historyA.some((item) => item.roundId === roundB.id)).toBe(false);
  expect(historyB.some((item) => item.roundId === roundB.id)).toBe(true);
  expect(historyB.some((item) => item.roundId === roundA.id)).toBe(false);
});
