import config from './playwright.config';
import { devices } from '@playwright/test';
export default {
  ...config,
  projects: process.env.PLAYBACK_BROWSER === 'firefox' ? [{ name: 'firefox', use: devices['Desktop Firefox'] }] : config.projects,
  testMatch: ['**/results.spec.js', '**/playback.spec.js', '**/combinedPlayback.spec.js'],
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  webServer: {
    ...config.webServer,
    reuseExistingServer: false,
    command: process.env.PLAYBACK_BUILD ? `npx vite preview --outDir ${process.env.PLAYBACK_BUILD} --host 127.0.0.1 --port 4173` : 'npm run build && npx vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/rainfall/',
    timeout: 120000
  }
};
