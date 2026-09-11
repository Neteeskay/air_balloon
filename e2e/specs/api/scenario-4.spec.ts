import { expect, test } from '@playwright/test';
import { ApiClient, type RoundView } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { RoundSocket } from '../../helpers/ws-client';
import { blocked } from '../../helpers/status';

test.describe.serial('Scenario 4 — booster', () => {
  test('S4-API x2 booster is server assigned, activates before cashout and adds points', async ({ request }) => {
    const api = new ApiClient(request, settings.authHeaders);
    await api.health();
    const socket = new RoundSocket(settings.wsUrl, settings.authHeaders);
    await socket.connect();
    try {
      const round = await api.startRound('GREEN', settings.stake, 2);
      expect(round.boosterMultiplier).toBe(2);
      expect(round.boosterActivated).toBe(false);
      const event = await socket.waitForRound(round.id, (item) => item.type === 'BOOSTER_ACTIVATED', settings.eventTimeoutMs);
      expect(event.data.booster).toBe(2);
      expect(event.data.level).toBeGreaterThanOrEqual(1);
      expect(decimalToScale(event.data.afterMultiplier, 4)).toBe(decimalToScale(event.data.beforeMultiplier, 4) * 2n);
      expect(Number(event.data.pointsToAward)).toBeGreaterThan(0);
      const snapshot = await api.snapshot(round.id);
      expect(snapshot.boosterActivated).toBe(true);
      expect(snapshot.boosterLevel).toBe(event.data.level);
      expect(snapshot.roundScore).toBeGreaterThan(0);
    } finally {
      socket.abort();
    }
  });

  for (const booster of [3, 4]) {
    test(`S4-API x${booster} supported booster multiplies exactly and awards extra points`, async ({ request }) => {
      const api = new ApiClient(request, settings.authHeaders);
      await api.health();
      const socket = new RoundSocket(settings.wsUrl, settings.authHeaders);
      await socket.connect();
      try {
        const round = await api.startRound('RED', settings.stake, booster);
        const event = await socket.waitForRound(round.id, (item) => item.type === 'BOOSTER_ACTIVATED', settings.eventTimeoutMs);
        expect(event.data.booster).toBe(booster);
        expect(decimalToScale(event.data.afterMultiplier, 4)).toBe(decimalToScale(event.data.beforeMultiplier, 4) * BigInt(booster));
        expect(Number(event.data.pointsToAward)).toBeGreaterThan(0);
      } finally {
        socket.abort();
      }
    });
  }

  test('S4-API cashout before booster prevents later activation and extra points', async ({ request }) => {
    const api = new ApiClient(request, settings.authHeaders);
    await api.health();
    const socket = new RoundSocket(settings.wsUrl, settings.authHeaders);
    await socket.connect();
    let candidate: RoundView | undefined;
    try {
      for (let attempt = 0; attempt < 5 && !candidate; attempt += 1) {
        const round = await api.startRound('GREEN', settings.stake, 2);
        await socket.waitForRound(round.id, (item) => item.type === 'LEVEL_REACHED', settings.eventTimeoutMs);
        const snapshot = await api.snapshot(round.id);
        if (!snapshot.boosterActivated && snapshot.cashoutAvailable) candidate = snapshot;
      }
      if (!candidate) blocked('No round with a booster level after Level 1 was produced in five attempts');
      const cashout = await api.cashout(candidate!.id);
      expect(cashout.response.status()).toBe(200);
      const final = await api.waitForSnapshot(candidate!.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
      expect(final.boosterActivated).toBe(false);
      expect(final.roundScore).toBe(cashout.body.roundScore);
      expect(socket.allForRound(candidate!.id).filter((event) => event.type === 'BOOSTER_ACTIVATED')).toHaveLength(0);
    } finally {
      socket.abort();
    }
  });
});
