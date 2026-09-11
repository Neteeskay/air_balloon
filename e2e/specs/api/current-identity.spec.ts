import { expect, test } from '@playwright/test';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('CURRENT-IDENTITY login principal, economy and history refer to the same user', async ({ request }) => {
  if (!Object.keys(settings.authHeaders).length || !Object.keys(settings.secondAuthHeaders).length) {
    blocked('Current-user auth contract is not published; configure two distinct auth header sets after Core integration');
  }
  const apiA = new ApiClient(request, settings.authHeaders);
  const apiB = new ApiClient(request, settings.secondAuthHeaders);
  await apiA.health();
  const users = await apiA.demoUsers();
  const userA = users.find((item) => item.username === settings.username);
  const userB = users.find((item) => item.username === settings.secondUsername);
  if (!userA || !userB) blocked('Configured users are unavailable');
  const beforeA = await apiA.userState(userA!.userId);
  const beforeB = await apiB.userState(userB!.userId);
  const round = await apiA.startRound('GREEN', settings.stake, 2);
  const afterA = await apiA.userState(userA!.userId);
  const afterB = await apiB.userState(userB!.userId);
  expect(decimalToScale(afterA.bonusBalance, 2)).toBe(decimalToScale(beforeA.bonusBalance, 2) - decimalToScale(settings.stake, 2));
  expect(decimalToScale(afterB.bonusBalance, 2)).toBe(decimalToScale(beforeB.bonusBalance, 2));
  await apiA.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
  const historyA = historyItems(await apiA.history());
  expect(historyA.some((item) => item.roundId === round.id && item.username === userA!.username)).toBe(true);
  expect(historyA.some((item) => item.roundId === round.id && item.username === userB!.username)).toBe(false);
});
