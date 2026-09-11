import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('CONFIG runtime parameter change affects new rounds while active round keeps its snapshot', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders);
  await api.health();
  const original = await api.adminConfig(settings.adminToken);
  if (!original?.config || !Number.isInteger(original.version)) blocked('Admin config response has no versioned config snapshot');
  if (!Number.isInteger(original.config.pointsPerLevel)) {
    blocked('Integrated config contract has no pointsPerLevel field; acceptance adapter must be aligned after Core merge');
  }
  const oldRound = await api.startRound('GREEN', settings.stake, 1);
  let changed: any;
  try {
    changed = await api.updateAdminConfig(settings.adminToken, original.version, {
      ...original.config,
      pointsPerLevel: original.config.pointsPerLevel + 1
    });
    expect(changed.version).toBeGreaterThan(original.version);
    const newRound = await api.startRound('GREEN', settings.stake, 1);
    const [oldAtLevel, newAtLevel] = await Promise.all([
      api.waitForSnapshot(oldRound.id, (round) => round.currentLevel >= 1, settings.eventTimeoutMs),
      api.waitForSnapshot(newRound.id, (round) => round.currentLevel >= 1, settings.eventTimeoutMs)
    ]);
    expect(newAtLevel.roundScore - oldAtLevel.roundScore).toBe(1);
  } finally {
    if (changed?.version) await api.updateAdminConfig(settings.adminToken, changed.version, original.config);
  }
});
