import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { verifyFairness, type FairnessProof } from '../../helpers/fairness';
import { RoundSocket } from '../../helpers/ws-client';

test('FAIRNESS commitment is early, seed hidden until crash, reveal verifies and tampering fails', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const socket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await socket.connect();
  try {
    const round = await api.startRound('GREEN', settings.stake, 2);
    expect(round.fairnessCommitment).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(round)).not.toContain('serverSeed');
    expect(round.crashMultiplier).toBeUndefined();
    const started = await socket.waitForRound(round.id, (event) => event.type === 'ROUND_STARTED', 10_000);
    expect(started.data.fairnessCommitment).toBe(round.fairnessCommitment);
    expect(JSON.stringify(started)).not.toContain('serverSeed');
    const committed = await api.fairness(round.id);
    expect(committed.status).toBe('COMMITTED');
    expect(committed.commitment).toBe(round.fairnessCommitment);
    expect(committed.serverSeed).toBeUndefined();
    expect(committed.crashMultiplier).toBeUndefined();

    await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
    const proof = await api.fairness(round.id) as FairnessProof;
    expect(proof.status).toBe('REVEALED');
    expect(typeof proof.serverSeed).toBe('string');
    expect(verifyFairness(proof, round.fairnessCommitment)).toBe(true);
    for (const tampered of [
      { ...proof, crashMultiplier: Number(proof.crashMultiplier) + 0.01 },
      { ...proof, boosterLevel: proof.boosterLevel === 12 ? 11 : 12 },
      { ...proof, serverSeed: (BigInt(proof.serverSeed) + 1n).toString() },
      { ...proof, roundId: '00000000-0000-0000-0000-000000000124' }
    ]) expect(verifyFairness(tampered, round.fairnessCommitment)).toBe(false);
  } finally {
    socket.abort();
  }
});
