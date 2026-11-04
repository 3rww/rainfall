import config from './playwright.config';
import { devices } from '@playwright/test';
export default {
  ...config,
  testMatch: ['**/playback.spec.js', '**/combinedPlayback.spec.js', '**/customPlayback.spec.js'],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] }
  ]
};
