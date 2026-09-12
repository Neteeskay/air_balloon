import { expect, test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../../helpers/env';
import { ApiClient } from '../../helpers/api-client';

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

  const api = new ApiClient(request);
  const current = await api.adminConfig(settings.adminToken);
  fs.writeFileSync(configFile, JSON.stringify(current));
  await api.updateAdminConfig(settings.adminToken, current.version, {
    ...current.config,
    minCrashMultiplier: 1,
    maxCrashMultiplier: 8.42,
    growthRate: 0.5
  });
});
