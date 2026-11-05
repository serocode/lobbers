import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    launchOptions: { args: ['--use-gl=angle', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
