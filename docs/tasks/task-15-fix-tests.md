# TASK-15 — Fix the test suite (DB bootstrap, schema drift, real failures)

**Status:** [ ] not started
**Priority:** high
**Docs:** [Code review → C10](../code-review.md#c10--the-dead-parser_new-suite-is-97-of-the-failures),
[C11](../code-review.md#c11--no-shared-test-db-bootstrap-schema-drift-in-in-memory-tests),
[C12](../code-review.md#c12--genuine-failures-to-triage-after-c10c11)

**Why:** `npm test` reports **175 failed / 75 passed**. ~169 come from the dead `parser_new` suite;
the rest from no shared test-DB bootstrap (tests on the real knex singleton hit an empty/unmigrated
`dev.sqlite3` → `no such table`), hand-built in-memory schemas that drift from migrations (missing
`video_songs`), and a handful of genuine parser/pagination assertion failures.

**Steps:**

- [ ] Delete `parser_new` and its test suite (done via [TASK-9](./task-09-remove-dead-code.md)) → removes
      ~169 failures.
- [ ] Add a Vitest `globalSetup`/`setupFiles` (in `vitest.config.ts`) that provisions a **dedicated**
      test DB via `knex.migrate.latest()` (+ minimal dictionary seeds); use a shared migrated SQLite
      (file or shared `:memory:`), never `dev.sqlite3` (pairs with [TASK-5](./task-05-knexfile-hardening.md)).
- [ ] Replace hand-built in-memory schemas in tests with the migrated schema so they can't drift
      (e.g. the missing `video_songs` in `dictionary.routes.test.ts`).
- [ ] Triage the genuine failures in `parser/parser.service.test.ts` (event `@SBS INKIGAYO`→`@INKIGAYO`,
      `camera_type` `FANCAM` vs `페이스캠4K`, apostrophe-splitting `What's`/`Eye-Poppin'`, solo detection
      `DAYOUNG`→`SOLO` vs `WJSN`) and `video.routes.pagination.test.ts` — fix parser or update stale
      expectations, one by one.

**Files:** `vitest.config.ts`, new `tests/setup.ts` (or `src/test/setup.ts`), `src/db/knexfile.ts`,
`src/**/*.test.ts`, `src/services/parser/**`.

**Acceptance:** `npm test` is green (0 failed); no test depends on a pre-existing `dev.sqlite3`; in-memory
tests use the migrated schema; CI can run the suite from a clean checkout.

**Depends on:** [TASK-9](./task-09-remove-dead-code.md) (removes `parser_new`); pairs with
[TASK-5](./task-05-knexfile-hardening.md) (separate test DB).

---

← back to [TODO](../../TODO.md)
