import path from 'path';
import { defineConfig } from '@playwright/test';

const serverRoot = __dirname;
const webRoot = path.join(__dirname, '../../apps/web');

export default defineConfig({
  testDir: path.join(serverRoot, 'tests/e2e'),
  timeout: 30_000,
  testMatch: ['**/*.e2e.ts', '**/*.spec.ts'],
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  globalSetup: path.join(serverRoot, 'tests/e2e/setup/globalSetup.ts'),
  globalTeardown: path.join(serverRoot, 'tests/e2e/setup/globalTeardown.ts'),
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node --import tsx --require ./tests/e2e/setup/youtube-mock.cjs ./src/index.ts',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        YOUTUBE_API_KEY: 'e2e-test-key',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      cwd: webRoot,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
