import { expect, test } from '@playwright/test';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';

test('MULTI-USER two cookie sessions isolate personal state and share global history', async ({ browser }) => {
  const emptyState = { cookies: [], origins: [] };
  const contextA = await browser.newContext({ baseURL: settings.apiUrl, storageState: emptyState });
  const contextB = await browser.newContext({ baseURL: settings.apiUrl, storageState: emptyState });
  const apiA = new ApiClient(contextA.request); const apiB = new ApiClient(contextB.request);
  await apiA.login(settings.username, settings.password);
  await apiB.login(settings.secondUsername, 'balloon2');
  const userA = await apiA.me(); const userB = await apiB.me();
  expect(userA.userId).not.toBe(userB.userId);
  const beforeA = await apiA.currentState(); const beforeB = await apiB.currentState();
  const roundA = await apiA.startRound('GREEN', settings.stake, 2);
  const roundB = await apiB.startRound('RED', settings.stake, 2);
  const afterA = await apiA.currentState(); const afterB = await apiB.currentState();
  expect(decimalToScale(afterA.bonusBalance, 2)).toBe(decimalToScale(beforeA.bonusBalance, 2) - decimalToScale(roundA.betAmount, 2));
  expect(decimalToScale(afterB.bonusBalance, 2)).toBe(decimalToScale(beforeB.bonusBalance, 2) - decimalToScale(roundB.betAmount, 2));
  await Promise.all([
    apiA.waitForSnapshot(roundA.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs),
    apiB.waitForSnapshot(roundB.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs)
  ]);
  const personalA = historyItems(await apiA.personalHistory()); const personalB = historyItems(await apiB.personalHistory());
  expect(personalA.some((item) => item.roundId === roundA.id)).toBe(true);
  expect(personalA.some((item) => item.roundId === roundB.id)).toBe(false);
  expect(personalB.some((item) => item.roundId === roundB.id)).toBe(true);
  expect(personalB.some((item) => item.roundId === roundA.id)).toBe(false);
  const globalA = historyItems(await apiA.history()); const globalB = historyItems(await apiB.history());
  for (const id of [roundA.id, roundB.id]) {
    expect(globalA.some((item) => item.roundId === id)).toBe(true);
    expect(globalB.some((item) => item.roundId === id)).toBe(true);
  }
  await contextA.close(); await contextB.close();
});
