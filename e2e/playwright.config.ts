import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const artifactsRoot = path.resolve(__dirname, '..', 'artifacts', 'acceptance');
const apiBaseUrl = process.env.ACCEPTANCE_API_URL ?? 'http://127.0.0.1:18080';
const frontendBaseUrl = process.env.ACCEPTANCE_FRONTEND_URL ?? 'http://127.0.0.1:5173';
const authFile = path.resolve(__dirname, '.auth', 'anna.json');
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
      name: 'auth-setup',
      testMatch: /setup\/auth\.setup\.ts/,
      teardown: 'acceptance-cleanup',
      use: { baseURL: apiBaseUrl, storageState: { cookies: [], origins: [] } }
    },
    {
      name: 'acceptance-cleanup',
      testMatch: /setup\/cleanup\.setup\.ts/,
      use: { baseURL: apiBaseUrl }
    },
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { baseURL: apiBaseUrl, storageState: authFile }
    },
    {
      name: 'browser',
      testMatch: /browser\/(?!matrix\.).*\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], baseURL: frontendBaseUrl }
    },
    {
      name: 'chromium',
      testMatch: /browser\/matrix\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], baseURL: frontendBaseUrl }
    },
    {
      name: 'firefox',
      testMatch: /browser\/matrix\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Firefox'], baseURL: frontendBaseUrl }
    },
    {
      name: 'webkit',
      testMatch: /browser\/matrix\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Safari'], baseURL: frontendBaseUrl }
    },
    {
      name: 'persistence-prepare',
      testMatch: /persistence\/prepare\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { baseURL: apiBaseUrl, storageState: authFile }
    },
    {
      name: 'persistence-verify',
      testMatch: /persistence\/verify\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { baseURL: apiBaseUrl, storageState: authFile }
    }
  ]
});
