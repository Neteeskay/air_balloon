import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const artifactsRoot = path.resolve(__dirname, '..', 'artifacts', 'acceptance');
const apiBaseUrl = process.env.ACCEPTANCE_API_URL ?? 'http://127.0.0.1:8080';
const frontendBaseUrl = process.env.ACCEPTANCE_FRONTEND_URL ?? 'http://127.0.0.1:5173';
const timeout = Number(process.env.ACCEPTANCE_TIMEOUT_MS ?? 120_000);

export default defineConfig({
  testDir: './specs',
  timeout,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: path.join(artifactsRoot, 'test-results'),
  reporter: [
    ['list'],
    ['./reporters/acceptance-reporter.ts', { outputDir: artifactsRoot }],
    ['json', { outputFile: path.join(artifactsRoot, 'playwright-report.json') }],
    ['html', { outputFolder: path.join(artifactsRoot, 'playwright-html'), open: 'never' }]
  ],
  use: {
    baseURL: frontendBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'harness', testMatch: /harness\/.*\.spec\.ts/ },
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      use: { baseURL: apiBaseUrl }
    },
    {
      name: 'browser',
      testMatch: /browser\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: frontendBaseUrl }
    },
    {
      name: 'persistence-prepare',
      testMatch: /persistence\/prepare\.spec\.ts/,
      use: { baseURL: apiBaseUrl }
    },
    {
      name: 'persistence-verify',
      testMatch: /persistence\/verify\.spec\.ts/,
      use: { baseURL: apiBaseUrl }
    }
  ]
});
