import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { settings } from '../../helpers/env';

test('S5-API final result exposes outcome, coefficients, points, booster and persisted reward', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const round = await api.startRound('RED', settings.stake, 2);
  const final = await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
  const result = await api.result(round.id);
  expect(result.roundId).toBe(round.id);
  expect(['WIN', 'LOSS']).toContain(result.result);
  expect(result.betAmount).toBeDefined();
  expect(result.crashMultiplier).toBeDefined();
  expect(result.score).toBe(final.roundScore);
  expect(result.reward).toEqual(expect.objectContaining({ roundId: round.id }));
  expect(final.boosterMultiplier).toBe(2);
});
