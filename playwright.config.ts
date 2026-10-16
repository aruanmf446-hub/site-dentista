import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import { VARIANTS } from './scripts/variants.mjs';

/**
 * Testes funcionais e visuais. Antes: `npm run test:build` (gera dist-<variante>).
 * No ambiente remoto, o Chromium pré-instalado é usado via CHROME_PATH.
 */
const localChrome = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROME_PATH || (fs.existsSync(localChrome) ? localChrome : undefined);

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: Object.entries(VARIANTS).map(([name, port]) => ({
    command: `node scripts/serve-static.mjs dist-${name} ${port}`,
    port,
    reuseExistingServer: true,
  })),
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
