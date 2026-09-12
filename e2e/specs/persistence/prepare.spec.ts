import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiClient, historyItems } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('PERSISTENCE-PREPARE stores completed-round checkpoint before backend restart', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const user = await api.me();
  const round = await api.startRound('GREEN', settings.stake, 3);
  await api.waitForSnapshot(round.id, (item) => item.cashoutAvailable, settings.eventTimeoutMs);
  await api.cashout(round.id, randomUUID());
  const final = await api.waitForSnapshot(round.id, (item) => item.status === 'FINISHED', settings.eventTimeoutMs);
  const offer = await api.scenario8Offer(round.id);
  expect(offer.response.status()).toBe(200);
  const purchaseKey = randomUUID();
  const purchase = await api.scenario8Purchase(offer.body!.offerId, purchaseKey);
  expect(purchase.response.status()).toBe(200);
  const state = await api.currentState();
  const result = await api.result(round.id);
  expect(historyItems(await api.history()).some((item) => item.roundId === round.id)).toBe(true);
  const checkpoint: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    userId: user.userId,
    username: user.username,
    balance: String(state.bonusBalance),
    gameScore: String(state.gameScore),
    lotteryTicketCount: String(state.lotteryTicketCount ?? 0),
    roundId: round.id,
    scenario8OfferId: offer.body!.offerId,
    scenario8PurchaseKey: purchaseKey,
    scenario8Purchase: purchase.body,
    result,
    final
  };
  if (process.env.ACCEPTANCE_ACTIVE_ROUND_RECOVERY === '1') {
    const active = await api.startRound('RED', settings.stake, 2);
    checkpoint.activeRoundId = active.id;
    checkpoint.activeSequence = active.sequence;
  }
  const output = path.resolve(__dirname, '..', '..', '..', 'artifacts', 'acceptance');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'restart-checkpoint.json'), JSON.stringify(checkpoint, null, 2));
});
