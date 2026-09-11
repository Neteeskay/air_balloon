import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { SequenceGuard } from '../../helpers/sequence-guard';

test('SEQUENCE replay events have ordered sequence/eventId/serverTime and recover an injected 10,12,11 gap', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const round = await api.startRound('GREEN', settings.stake, 2);
  await api.waitForSnapshot(round.id, (item) => item.sequence >= 12, settings.eventTimeoutMs);
  const replay = await api.replay(round.id, 9);
  expect(replay.snapshotRequired).toBe(false);
  expect(replay.events.length).toBeGreaterThanOrEqual(3);
  const ten = replay.events.find((event) => event.sequence === 10);
  const eleven = replay.events.find((event) => event.sequence === 11);
  const twelve = replay.events.find((event) => event.sequence === 12);
  expect(ten && eleven && twelve).toBeTruthy();
  for (const event of [ten!, eleven!, twelve!]) {
    expect(event.eventId).toBe(`${round.id}:${event.sequence}`);
    expect(Date.parse(event.serverTime)).not.toBeNaN();
  }
  const guard = new SequenceGuard(round.id, 9);
  expect(guard.inspect(ten!)).toBe('APPLIED');
  expect(guard.inspect(twelve!)).toBe('GAP');
  expect(guard.current()).toBe(10);
  const recovery = await api.replay(round.id, guard.current());
  for (const event of recovery.events) expect(guard.inspect(event)).toBe('APPLIED');
  expect(guard.current()).toBe(recovery.latestSequence);
});
