import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('PERSISTENCE-VERIFY user, balance, history and completed result survive backend restart', async ({ request }) => {
  const file = path.resolve(__dirname, '..', '..', '..', 'artifacts', 'acceptance', 'restart-checkpoint.json');
  if (!fs.existsSync(file)) blocked('Restart checkpoint is missing; run persistence-prepare before restart');
  const checkpoint = JSON.parse(fs.readFileSync(file, 'utf8'));
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const users = await api.demoUsers();
  expect(users.some((item) => item.userId === checkpoint.userId && item.username === checkpoint.username)).toBe(true);
  const state = await api.userState(checkpoint.userId);
  expect(String(state.bonusBalance)).toBe(checkpoint.balance);
  expect(String(state.gameScore)).toBe(checkpoint.gameScore);
  const result = await api.result(checkpoint.roundId);
  expect(result).toEqual(checkpoint.result);
  expect(historyItems(await api.history()).some((item) => item.roundId === checkpoint.roundId)).toBe(true);
  if (checkpoint.activeRoundId) {
    const recovered = await api.snapshot(checkpoint.activeRoundId);
    expect(recovered.sequence).toBeGreaterThanOrEqual(checkpoint.activeSequence);
    expect(['RUNNING', 'CASHED_OUT', 'FINISHED']).toContain(recovered.status);
  }
});
