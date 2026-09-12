import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';
import { decimalToScale } from '../../helpers/decimal';

test('PERSISTENCE-VERIFY user, balance, history and completed result survive backend restart', async ({ request }) => {
  const file = path.resolve(__dirname, '..', '..', '..', 'artifacts', 'acceptance', 'restart-checkpoint.json');
  if (!fs.existsSync(file)) blocked('Restart checkpoint is missing; run persistence-prepare before restart');
  const checkpoint = JSON.parse(fs.readFileSync(file, 'utf8'));
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const users = await api.demoUsers();
  expect(users.some((item) => item.userId === checkpoint.userId && item.username === checkpoint.username)).toBe(true);
  const state = await api.currentState();
  expect(state.userId).toBe(checkpoint.userId);
  const expectedBalance = checkpoint.activeRoundId
    ? decimalToScale(checkpoint.balance, 2) - decimalToScale(checkpoint.activeStake, 2)
    : decimalToScale(checkpoint.balance, 2);
  expect(decimalToScale(state.bonusBalance, 2)).toBe(expectedBalance);
  if (checkpoint.activeRoundId) expect(Number(state.gameScore)).toBeGreaterThanOrEqual(Number(checkpoint.gameScore));
  else expect(String(state.gameScore)).toBe(checkpoint.gameScore);
  expect(String(state.lotteryTicketCount ?? 0)).toBe(checkpoint.lotteryTicketCount);
  const replayedPurchase = await api.scenario8Purchase(checkpoint.scenario8OfferId, checkpoint.scenario8PurchaseKey);
  expect(replayedPurchase.response.status()).toBe(200);
  expect(replayedPurchase.body).toEqual({ ...checkpoint.scenario8Purchase, replayed: true });
  const result = await api.result(checkpoint.roundId);
  const { serverTime: currentServerTime, ...durableResult } = result;
  const { serverTime: checkpointServerTime, ...expectedResult } = checkpoint.result;
  expect(Date.parse(currentServerTime)).not.toBeNaN();
  expect(Date.parse(checkpointServerTime)).not.toBeNaN();
  expect(durableResult).toEqual(expectedResult);
  expect(historyItems(await api.history()).some((item) => item.roundId === checkpoint.roundId)).toBe(true);
  if (checkpoint.activeRoundId) {
    const recovered = await api.snapshot(checkpoint.activeRoundId);
    expect(recovered.sequence).toBeGreaterThanOrEqual(checkpoint.activeSequence);
    expect(['RUNNING', 'CASHED_OUT', 'FINISHED']).toContain(recovered.status);
    expect(recovered.cashoutPerformed).toBe(false);
    expect(Number(recovered.winAmount)).toBe(0);
  }
});
