import { expect, test } from '@playwright/test';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';

test('CURRENT-IDENTITY login principal, economy and history refer to the same user', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const me = await api.me();
  expect(me.username).toBe(settings.username);
  const before = await api.currentState();
  const round = await api.startRound('GREEN', settings.stake, 2);
  const after = await api.currentState();
  expect(decimalToScale(after.bonusBalance, 2)).toBe(decimalToScale(before.bonusBalance, 2) - decimalToScale(settings.stake, 2));
  await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
  const personal = historyItems(await api.personalHistory());
  expect(personal.some((item) => item.roundId === round.id)).toBe(true);
});
