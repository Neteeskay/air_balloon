import { expect, test as teardown } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../../helpers/env';
import { ApiClient } from '../../helpers/api-client';

const configFile = path.resolve(__dirname, '..', '..', '.auth', 'original-config.json');

teardown('restore runtime config after REAL acceptance', async ({ request }) => {
  if (!fs.existsSync(configFile)) return;
  const original = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const api = new ApiClient(request);
  const current = await api.adminConfig(settings.adminToken);
  await api.updateAdminConfig(settings.adminToken, current.version, original.config);
  fs.rmSync(configFile, { force: true });
});
