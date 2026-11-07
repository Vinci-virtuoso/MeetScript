import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  workers: 2,
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run preview:local',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    env: {
      ASTRO_TELEMETRY_DISABLED: '1',
      XDG_CONFIG_HOME: '/tmp/meetscript-config',
    },
    timeout: 60000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
