import { vi } from 'vitest';

/**
 * Make `console.error` / `console.warn` throw during tests.
 *
 * Some code paths catch an error and only log it (e.g. the parser swallowing a
 * DB error via `console.warn('Parser module failed:', e)`). Such a test still
 * "passes", so `npm test` exits 0 and the CI job stays green while a real error
 * slipped through — exactly what happened on PR #94, where a missing in-memory
 * table only produced an `SqliteError` on stderr yet the job went green.
 *
 * Throwing here turns a stray `console.error` into a hard failure: either the
 * test fails directly, or (when it is logged from a detached promise) it becomes
 * an unhandled rejection that Vitest fails the run on. Errors can no longer hide.
 *
 * A test that genuinely expects an error to be logged should spy on
 * `console.error` itself, which overrides this mock for that test.
 */
for (const level of ['error', 'warn'] as const) {
  vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
    throw new Error(`console.${level} called during test: ${args.map((a) => String(a)).join(' ')}`);
  });
}
