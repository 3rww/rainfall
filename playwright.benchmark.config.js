import config from './playwright.config';
export default {
  ...config,
  testMatch: '**/results.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  webServer: {
    ...config.webServer,
    reuseExistingServer: false,
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/rainfall/',
    timeout: 120000
  }
};
