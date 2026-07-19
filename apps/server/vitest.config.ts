import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globalSetup: ['./tests/vitest.global-setup.ts'],
    setupFiles: ['./tests/vitest.setup.ts'],
    // All test files share one on-disk SQLite database (TEST_DATABASE_PATH). Running them in
    // parallel lets two connections attempt a write transaction at once; SQLite returns
    // SQLITE_BUSY ("database is locked") on the lock upgrade without honouring busy_timeout.
    // Serialise the files so there is only ever one writer — the suite is small and fast.
    fileParallelism: false,
    // NODE_ENV=test selects the `test` section of vidpulse.config.yaml (which supplies
    // youtube.apiKey=test-key etc.), so tests never depend on the developer's real config.
    env: {
      NODE_ENV: 'test',
    },
  },
});
