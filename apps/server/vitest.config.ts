import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globalSetup: ['./tests/vitest.global-setup.ts'],
    setupFiles: ['./tests/vitest.setup.ts'],
    // Tests must not depend on the developer's real environment.
    env: {
      NODE_ENV: 'test',
      YOUTUBE_API_KEY: 'test-key',
      LM_STUDIO_API_KEY: '',
    },
  },
});
