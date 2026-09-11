import { expect, test } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client';
import { settings } from '../../helpers/env';
import { blocked } from '../../helpers/status';

test('S5-RUNTIME-CONFIG V1 active round is immutable, V2 affects new round, original is restored as V3', async ({ request }) => {
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
    expect(oldAtLevel.roundScore).toBe(original.config.pointsPerLevel * oldAtLevel.currentLevel);
    expect(newAtLevel.roundScore).toBe((original.config.pointsPerLevel + 1) * newAtLevel.currentLevel);
  } finally {
    if (changed?.version) {
      const restored = await api.updateAdminConfig(settings.adminToken, changed.version, original.config);
      expect(restored.version).toBeGreaterThan(changed.version);
      expect(restored.config.pointsPerLevel).toBe(original.config.pointsPerLevel);
    }
  }
});

test('S5-VALIDATION every accepted edge config can start a round; engine-incompatible values are rejected', async ({ request }) => {
  const api = new ApiClient(request, settings.authHeaders); const original = await api.adminConfig(settings.adminToken);
  const incompatible = [
    { boosterValues: [1, 3, 5, 8] },
    { minCrashMultiplier: 0.9999 },
    { minCrashMultiplier: 1.00001 },
    { growthRate: 10.0001 },
    { growthRate: 0.00011 },
    { alpha: 0.009 }
  ];
  for (const mutation of incompatible) {
    const response = await request.put('/api/admin/config', {
      headers: { 'X-Admin-Token': settings.adminToken },
      data: { expectedVersion: original.version, config: { ...original.config, ...mutation } }
    });
    expect(response.status(), `${JSON.stringify(mutation)}: ${await response.text()}`).toBe(400);
  }
  let accepted: any;
  try {
    accepted = await api.updateAdminConfig(settings.adminToken, original.version, {
      ...original.config, minCrashMultiplier: 1, maxCrashMultiplier: 1.0001,
      growthRate: 0.0001, alpha: 0.01, boosterValues: [1, 2, 3, 4]
    });
    const round = await api.startRound('GREEN', settings.stake, 4);
    expect(round.id).toBeTruthy(); expect(round.boosterMultiplier).toBe(4);
  } finally {
    if (accepted?.version) await api.updateAdminConfig(settings.adminToken, accepted.version, original.config);
  }
});
