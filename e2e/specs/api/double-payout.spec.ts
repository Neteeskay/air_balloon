import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../../helpers/api-client';
import { decimalToScale, equalDecimal } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { RoundSocket } from '../../helpers/ws-client';
import { blocked } from '../../helpers/status';

test('DOUBLE-PAYOUT 100 simultaneous retries with one idempotency key credit exactly once', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const initial = await api.currentState();
  const socket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await socket.connect();
  try {
    const round = await api.startRound('GREEN', settings.stake, 2);
    await socket.waitForRound(round.id, (event) => event.type === 'BOOSTER_ACTIVATED', settings.eventTimeoutMs);
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 100 }, () => api.cashout(round.id, key)));
    expect(responses.every(({ response }) => response.status() === 200)).toBe(true);
    const payout = responses[0].body.winAmount;
    expect(responses.every(({ body }) => equalDecimal(body.winAmount, payout, 2))).toBe(true);
    await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
    const current = await api.currentState();
    expect(decimalToScale(current.bonusBalance, 2)).toBe(
      decimalToScale(initial.bonusBalance, 2) - decimalToScale(round.betAmount, 2) + decimalToScale(payout, 2)
    );
  } finally {
    socket.abort();
  }
});
