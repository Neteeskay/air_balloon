import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../../helpers/api-client';
import { decimalToScale, equalDecimal } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { SequenceGuard } from '../../helpers/sequence-guard';
import { RoundSocket } from '../../helpers/ws-client';

test('WS-RECONNECT disconnect, snapshot and replay restore multiplier, level, booster and sequence', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const firstSocket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await firstSocket.connect();
  const round = await api.startRound('GREEN', settings.stake, 2);
  const observed = await firstSocket.waitForRound(round.id, (event) => event.sequence >= 2, settings.eventTimeoutMs);
  const oldSequence = observed.sequence;
  await firstSocket.close();

  const progressed = await api.waitForSnapshot(round.id, (item) => item.sequence > oldSequence, settings.eventTimeoutMs);
  const secondSocket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await secondSocket.connect();
  try {
    const snapshot = await api.snapshot(round.id);
    expect(decimalToScale(snapshot.currentMultiplier, 4)).toBeGreaterThanOrEqual(decimalToScale(progressed.currentMultiplier, 4));
    expect(snapshot.currentLevel).toBeGreaterThanOrEqual(progressed.currentLevel);
    expect(Number(snapshot.boosterActivated)).toBeGreaterThanOrEqual(Number(progressed.boosterActivated));
    expect(snapshot.cashoutPerformed).toBe(progressed.cashoutPerformed);
    expect(snapshot.cashoutPreviewAmount).toBeDefined();
    expect(snapshot.sequence).toBeGreaterThanOrEqual(progressed.sequence);

    const replay = await api.replay(round.id, oldSequence);
    expect(replay.snapshotRequired).toBe(false);
    const guard = new SequenceGuard(round.id, oldSequence);
    for (const event of replay.events) expect(guard.inspect(event)).toBe('APPLIED');
    expect(guard.current()).toBe(replay.latestSequence);

    const live = await secondSocket.waitForRound(round.id, (event) => event.sequence > snapshot.sequence, settings.eventTimeoutMs);
    expect(live.eventId).toBe(`${round.id}:${live.sequence}`);
    expect(Date.parse(live.serverTime)).not.toBeNaN();
  } finally {
    secondSocket.abort();
  }
});

test('WS-RECONNECT-CASHOUT fixed cashout survives reconnect and retry without second payout', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  const firstSocket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await firstSocket.connect();
  const round = await api.startRound('GREEN', settings.stake, 2);
  await firstSocket.waitForRound(round.id, (event) => event.type === 'BOOSTER_ACTIVATED', settings.eventTimeoutMs);
  const key = randomUUID();
  const cashout = await api.cashout(round.id, key);
  expect(cashout.response.status()).toBe(200);
  await firstSocket.close();

  const secondSocket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await secondSocket.connect();
  try {
    const restored = await api.snapshot(round.id);
    expect(restored.cashoutPerformed).toBe(true);
    expect(equalDecimal(restored.cashoutMultiplier!, cashout.body.cashoutMultiplier)).toBe(true);
    expect(equalDecimal(restored.winAmount, cashout.body.winAmount, 2)).toBe(true);
    const retry = await api.cashout(round.id, key);
    expect(retry.response.status()).toBe(200);
    expect(equalDecimal(retry.body.winAmount, cashout.body.winAmount, 2)).toBe(true);
    const final = await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
    expect(equalDecimal(final.cashoutMultiplier!, cashout.body.cashoutMultiplier)).toBe(true);
    expect(equalDecimal(final.winAmount, cashout.body.winAmount, 2)).toBe(true);
  } finally {
    secondSocket.abort();
  }
});
