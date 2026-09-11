import { expect, test as teardown } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../../helpers/env';

const configFile = path.resolve(__dirname, '..', '..', '.auth', 'original-config.json');

teardown('restore runtime config after REAL acceptance', async ({ request }) => {
  if (!fs.existsSync(configFile)) return;
  const original = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const currentResponse = await request.get('/api/admin/config', {
    headers: { 'X-Admin-Token': settings.adminToken }
  });
  expect(currentResponse.status(), await currentResponse.text()).toBe(200);
  const current = await currentResponse.json();
  const restoreResponse = await request.put('/api/admin/config', {
    headers: { 'X-Admin-Token': settings.adminToken },
    data: { expectedVersion: current.version, config: original.config }
  });
  expect(restoreResponse.status(), await restoreResponse.text()).toBe(200);
  fs.rmSync(configFile, { force: true });
});
