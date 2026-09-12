import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { decimalToScale, equalDecimal, multiplyMoney } from '../../helpers/decimal';
import { settings } from '../../helpers/env';
import { RoundSocket } from '../../helpers/ws-client';
import { blocked } from '../../helpers/status';

test('S2-API successful cashout is fixed, paid once, finishes and enters result/history', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const initial = await api.currentState();
  const socket = new RoundSocket(settings.wsUrl, settings.authHeaders);
  await socket.connect();
  try {
    const round = await api.startRound('GREEN', settings.stake, settings.booster);
    expect(equalDecimal(round.cashoutPreviewAmount!, settings.stake, 2)).toBe(true);
    const early = await api.cashout(round.id);
    expect(early.response.status()).toBe(409);
    expect(early.body.code).toBe('CASHOUT_NOT_AVAILABLE_YET');

    await socket.waitForRound(round.id, (event) => event.type === 'BOOSTER_ACTIVATED', settings.eventTimeoutMs);
    const beforeCashout = await api.snapshot(round.id);
    expect(beforeCashout.currentLevel).toBeGreaterThanOrEqual(1);
    expect(beforeCashout.cashoutAvailable).toBe(true);
    expect(beforeCashout.cashoutPreviewAmount).toBeDefined();
    const key = randomUUID();
    const first = await api.cashout(round.id, key);
    expect(first.response.status()).toBe(200);
    expect(first.body.cashoutPerformed).toBe(true);
    const fixed = first.body.cashoutMultiplier;
    const payout = first.body.winAmount;
    expect(decimalToScale(payout, 2)).toBeGreaterThanOrEqual(decimalToScale(beforeCashout.cashoutPreviewAmount!, 2));
    expect(decimalToScale(payout, 0)).toBe(decimalToScale(multiplyMoney(settings.stake, fixed), 0));

    const retry = await api.cashout(round.id, key);
    expect(retry.response.status()).toBe(200);
    expect(equalDecimal(retry.body.cashoutMultiplier, fixed)).toBe(true);
    expect(equalDecimal(retry.body.winAmount, payout, 2)).toBe(true);
    const duplicate = await api.cashout(round.id, randomUUID());
    expect(duplicate.response.status()).toBe(409);
    expect(['ALREADY_CASHED_OUT', 'ROUND_ALREADY_CRASHED']).toContain(duplicate.body.code);

    const final = await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
    expect(final.outcome).toBe('CASHED_OUT');
    expect(equalDecimal(final.cashoutMultiplier!, fixed)).toBe(true);
    expect(equalDecimal(final.winAmount, payout, 2)).toBe(true);
    expect(decimalToScale(final.currentMultiplier, 4)).toBeGreaterThan(decimalToScale(fixed, 4));

    const current = await api.currentState();
    expect(decimalToScale(current.bonusBalance, 2)).toBe(
      decimalToScale(initial.bonusBalance, 2) - decimalToScale(settings.stake, 2) + decimalToScale(payout, 2)
    );
    const result = await api.result(round.id);
    expect(result.roundId).toBe(round.id);
    expect(result.result).toBe('WIN');
    expect(equalDecimal(result.winAmount, payout, 2)).toBe(true);
    expect(result.potentialWinAmount).toBeGreaterThanOrEqual(result.winAmount);
    expect(historyItems(await api.personalHistory()).some((item) => item.roundId === round.id && item.result === 'WIN')).toBe(true);
  } finally {
    socket.abort();
  }
});
