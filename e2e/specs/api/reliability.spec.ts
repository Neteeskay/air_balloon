import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { verifyFairness, type FairnessProof } from '../../helpers/fairness';
import { randomUUID } from 'node:crypto';
import { decimalToScale } from '../../helpers/decimal';

test('START-IDEMPOTENCY 100 simultaneous retries create one round and one debit', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  const before = await api.currentState(); const key = randomUUID();
  const rounds = await Promise.all(Array.from({ length: 100 }, () => api.startRound('GREEN', settings.stake, 2, key)));
  expect(new Set(rounds.map((round) => round.id)).size).toBe(1);
  const after = await api.currentState();
  expect(decimalToScale(after.bonusBalance, 2)).toBe(decimalToScale(before.bonusBalance, 2) - decimalToScale(settings.stake, 2));
});

test('RELIABILITY 100 parallel rounds produce unique round IDs and commitments', async ({ request }) => {
  test.setTimeout(Math.max(180_000, settings.eventTimeoutMs));
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const stake = process.env.ACCEPTANCE_RELIABILITY_STAKE ?? '1';
  const rounds = await Promise.all(Array.from({ length: 100 }, (_, index) =>
    api.startRound(index % 2 ? 'RED' : 'GREEN', stake, 2)
  ));
  expect(new Set(rounds.map((round) => round.id)).size).toBe(100);
  expect(new Set(rounds.map((round) => round.fairnessCommitment)).size).toBe(100);
  expect(rounds.filter((round) => round.theme === 'GREEN').every((round) => round.totalLevels === 9)).toBe(true);
  expect(rounds.filter((round) => round.theme === 'RED').every((round) => round.totalLevels === 12)).toBe(true);
  await Promise.all(rounds.map((round) => api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs)));
  const proofs = await Promise.all(rounds.map((round) => api.fairness(round.id) as Promise<FairnessProof>));
  expect(proofs).toHaveLength(100);
  for (let index = 0; index < rounds.length; index += 1) {
    expect(typeof proofs[index].serverSeed).toBe('string');
    expect(verifyFairness(proofs[index], rounds[index].fairnessCommitment)).toBe(true);
  }
});
