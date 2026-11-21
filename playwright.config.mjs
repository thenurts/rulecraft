import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.e2e.mjs',
  testIgnore: '**/pages.e2e.mjs',
  timeout: 60_000,
  workers: 1,
  reporter: process.env.GITHUB_ACTIONS ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    actionTimeout: 8000,
    launchOptions: process.env.RULECRAFT_CHROMIUM ? { executablePath: process.env.RULECRAFT_CHROMIUM } : {},
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
  },
});
