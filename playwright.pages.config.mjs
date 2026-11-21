import { defineConfig } from '@playwright/test';
import config from './playwright.config.mjs';

const baseURL = 'http://127.0.0.1:4176/rulecraft/';

export default defineConfig({
  ...config,
  testIgnore: [],
  use: { ...config.use, baseURL },
  webServer: {
    command: 'npm run preview -- --base=/rulecraft/ --host 127.0.0.1 --port 4176 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
});
