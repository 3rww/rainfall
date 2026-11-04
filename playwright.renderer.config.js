import config from './playwright.config';
import { devices } from '@playwright/test';
const directory = process.env.PLAYBACK_BUILD || 'dist';
export default {
  ...config, outputDir: process.env.PLAYBACK_REPORT_DIR ? `${process.env.PLAYBACK_REPORT_DIR}/playwright` : 'test-results', testMatch: '**/rendererBenchmark.spec.js', fullyParallel: false, workers: 1, timeout: 240000,
  projects: [{ name: process.env.PLAYBACK_BROWSER || 'chromium', use: devices[process.env.PLAYBACK_BROWSER === 'firefox' ? 'Desktop Firefox' : 'Desktop Chrome'] }],
  use: { ...config.use, baseURL: 'http://127.0.0.1:4175' },
  webServer: { ...config.webServer, command: `npx vite preview --outDir ${directory} --host 127.0.0.1 --port 4175`, url: 'http://127.0.0.1:4175/rainfall/', reuseExistingServer: false }
};
