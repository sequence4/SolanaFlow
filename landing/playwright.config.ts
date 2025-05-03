/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'E2E=1 pnpm --filter landing run build && E2E=1 pnpm --filter landing run start:prod',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: true,
  },
}); 