import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL=http://localhost:4173 runs the suites against a production build (pnpm build && pnpm preview) or a deploy.
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: external ?? 'http://localhost:5173',
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
    launchOptions: { args: ['--use-gl=angle', '--ignore-gpu-blocklist'] },
  },
  webServer: external ? undefined : { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
