import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8788',
    ...devices['Pixel 7'],
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    // Local Workers runtime serving the production build. Tests intercept /api/assistant so no Gemini quota is used.
    command: 'npx wrangler dev --port 8788 --ip 127.0.0.1',
    url: 'http://127.0.0.1:8788/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
