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
    // Tests must not depend on the developer's real environment.
    env: {
      NODE_ENV: 'test',
      YOUTUBE_API_KEY: 'test-key',
      LM_STUDIO_API_KEY: '',
    },
  },
});
