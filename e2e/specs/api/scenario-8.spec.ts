import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../../helpers/api-client';
import { decimalToScale } from '../../helpers/decimal';
import { settings } from '../../helpers/env';

async function finishWin(api: ApiClient) {
  const round = await api.startRound('GREEN', settings.stake, 3);
  await api.waitForSnapshot(round.id, item => item.cashoutAvailable, settings.eventTimeoutMs);
  const cashout = await api.cashout(round.id, randomUUID());
  expect(cashout.response.status(), JSON.stringify(cashout.body)).toBe(200);
  await api.waitForSnapshot(round.id, item => item.status === 'FINISHED', settings.eventTimeoutMs);
  return { round, payout: cashout.body.winAmount };
}

test('S8-API WIN offer is owner-only and 100 purchase retries debit and credit exactly once', async ({ request, browser }) => {
  const api = new ApiClient(request, settings.authHeaders);
  const beforeRound = await api.currentState();
  const { round, payout } = await finishWin(api);
  const offered = await api.scenario8Offer(round.id);
  expect(offered.response.status()).toBe(200);
  expect(offered.body).toMatchObject({ roundId: round.id, status: 'AVAILABLE' });
  const offer = offered.body!;

  const beforePurchase = await api.currentState();
  const key = randomUUID();
  const purchases = await Promise.all(Array.from({ length: 100 }, () => api.scenario8Purchase(offer.offerId, key)));
  expect(purchases.every(item => item.response.status() === 200)).toBe(true);
  expect(purchases.filter(item => item.body.replayed === false)).toHaveLength(1);
  expect(purchases.every(item => item.body.price === offer.price && item.body.ticketCount === offer.ticketCount)).toBe(true);

  const after = await api.currentState();
  expect(decimalToScale(after.bonusBalance, 0)).toBe(decimalToScale(beforePurchase.bonusBalance, 0) - BigInt(offer.price));
  expect(decimalToScale(after.lotteryTicketCount ?? 0, 0)).toBe(decimalToScale(beforePurchase.lotteryTicketCount ?? 0, 0) + BigInt(offer.ticketCount));
  expect(decimalToScale(beforePurchase.bonusBalance, 0)).toBe(
    decimalToScale(beforeRound.bonusBalance, 0) - decimalToScale(round.betAmount, 0) + decimalToScale(payout, 0)
  );
  const consumed = await api.scenario8Purchase(offer.offerId, randomUUID());
  expect(consumed.response.status()).toBe(409);
  expect(consumed.body.code).toBe('OFFER_ALREADY_CONSUMED');

  const otherContext = await browser.newContext({
    baseURL: settings.apiUrl,
    storageState: { cookies: [], origins: [] }
  });
  const other = new ApiClient(otherContext.request);
  try {
    await other.login(settings.secondUsername, 'balloon2');
    const foreignRound = await otherContext.request.get(`/api/rounds/${round.id}`);
    expect(foreignRound.status()).toBe(403);
    const foreignOffer = await other.scenario8Offer(round.id);
    expect(foreignOffer.response.status()).toBe(403);
    const foreignPurchase = await other.scenario8Purchase(offer.offerId, randomUUID());
    expect(foreignPurchase.response.status()).toBe(403);
  } finally {
    await otherContext.close();
  }

  const reloginContext = await browser.newContext({
    baseURL: settings.apiUrl,
    storageState: { cookies: [], origins: [] }
  });
  try {
    const relogged = new ApiClient(reloginContext.request);
    await relogged.login(settings.username, settings.password);
    expect((await relogged.currentState()).lotteryTicketCount).toBe(after.lotteryTicketCount);
  } finally {
    await reloginContext.close();
  }
});

test('S8-API LOSS has no offer and existing offers retain snapshotted config', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  const current = await api.adminConfig(settings.adminToken);
  let latest = current;
  try {
    const first = await finishWin(api);
    const oldOffer = await api.scenario8Offer(first.round.id);
    expect(oldOffer.response.status()).toBe(200);
    const newPrice = Number(oldOffer.body!.price) + 7;
    latest = await api.updateAdminConfig(settings.adminToken, current.version, { ...current.config, scenario8Price: newPrice });
    expect((await api.scenario8Offer(first.round.id)).body?.price).toBe(oldOffer.body!.price);

    const second = await finishWin(api);
    expect((await api.scenario8Offer(second.round.id)).body?.price).toBe(newPrice);

    const loss = await api.startRound('GREEN', settings.stake, 1);
    await api.waitForSnapshot(loss.id, item => item.status === 'FINISHED', settings.eventTimeoutMs);
    const noOffer = await api.scenario8Offer(loss.id);
    expect(noOffer.response.status()).toBe(204);
    expect(noOffer.body).toBeNull();
  } finally {
    const now = await api.adminConfig(settings.adminToken);
    await api.updateAdminConfig(settings.adminToken, now.version, current.config);
  }
});
