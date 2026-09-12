import { expect, test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../../helpers/env';

const authFile = path.resolve(__dirname, '..', '..', '.auth', 'anna.json');
const configFile = path.resolve(__dirname, '..', '..', '.auth', 'original-config.json');

setup('REAL cookie session for API acceptance', async ({ request }) => {
  const response = await request.post('/api/auth/demo-login', {
    data: { username: settings.username, password: settings.password }
  });
  expect(response.status(), await response.text()).toBe(200);
  expect((await response.json()).username).toBe(settings.username);
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await request.storageState({ path: authFile });

  const currentResponse = await request.get('/api/admin/config', {
    headers: { 'X-Admin-Token': settings.adminToken }
  });
  expect(currentResponse.status(), await currentResponse.text()).toBe(200);
  const current = await currentResponse.json();
  fs.writeFileSync(configFile, JSON.stringify(current));
  const fastResponse = await request.put('/api/admin/config', {
    headers: { 'X-Admin-Token': settings.adminToken },
    data: {
      expectedVersion: current.version,
      config: {
        ...current.config,
        minBet: 1,
        maxBet: 40,
        minCrashMultiplier: 8.42,
        maxCrashMultiplier: 8.42,
        growthRate: 0.5,
        updateIntervalMs: 16
      }
    }
  });
  expect(fastResponse.status(), await fastResponse.text()).toBe(200);
});
