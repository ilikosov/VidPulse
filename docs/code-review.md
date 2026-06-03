# Application code review

Findings from a review of the application code in [`src/`](../src) (backend) — separate from the
migrations/DB review in [`migrations-review.md`](./migrations-review.md). Items are correctness/structure
issues worth fixing, ranked by severity. The pre-existing fragile dictionary read joins are already
tracked by [TODO TASK-1](../TODO.md) and not repeated here.

> Actionable items are tracked in [`TODO.md`](../TODO.md) (TASK-9…15).

---

## 🔴 Worth fixing

### C1 — Dead code: `src/services/parser_new/`

`src/services/parser_new/` (~500 LOC across `parser.service.ts` + a module) has **zero references** in the
codebase (verified: not imported by `src/`, scripts, or tests). It shadows the active
`src/services/parser/`. Dead code rots and confuses readers.
**Fix:** delete it, or, if it is the intended replacement, wire it in and remove the old one.

### C2 — No central error handling / 404 handler

`src/index.ts` mounts routes but registers **no Express error-handling middleware** and **no 404
handler**. Each route hand-rolls `try/catch` (e.g. `video.routes.ts` has 23 `try` blocks for 19 handlers)
and returns ad-hoc `res.status(500)` shapes. Express 4 also does not catch errors thrown in `async`
handlers, so any handler that forgets `try/catch` will hang/crash the request.
**Fix:** add a terminal error-handling middleware with a consistent error body, a 404 fallthrough, and an
`asyncHandler` wrapper so handlers can drop boilerplate `try/catch`.

### C3 — Unused dependency `sqlite3`

`package.json` depends on both `sqlite3` and `better-sqlite3`, but the knex client is `better-sqlite3`
and `sqlite3` is referenced nowhere in code. It pulls an extra native build.
**Fix:** remove `sqlite3` from dependencies.

---

## 🟡 Architectural (not bugs)

### C4 — Import-time side effects in `src/index.ts`

`createAppContainer()` (opens the DB) and `app.listen()` run **at import time**, and `app` is exported as
default. Importing the app for an in-process integration test would open a DB connection and bind a port;
`runScheduler()` also starts on import. (Today e2e dodges this by launching `npm run dev` as a
subprocess.)
**Fix:** export an app/container factory; guard `app.listen()`/`runScheduler()` behind
`if (require.main === module)`. Also unblocks in-process tests and the monorepo move
([ADR 0003](./adr/0003-monorepo.md)).

### C5 — Data access in routes bypasses the service/repository layer

Routes import `knex` directly and run queries inline (e.g. `src/routes/video.routes.ts` imports `../db`
and queries within handlers). The `src/repositories/` "data-access layer" is a single file
(`knex.repositories.ts`) used only by `compositionRoot.ts`; services also query knex directly. This
contradicts the layered design described in [`CLAUDE.md`](../CLAUDE.md) ("thin routes, logic in
services").
**Fix:** move DB access out of routes into services/repositories; keep routes thin (parse input → call
service → format response).

### C6 — God files

`src/services/dictionary.service.ts` is **1620 LOC** and `src/routes/video.routes.ts` is **1213 LOC** —
hard to navigate, test, and review.
**Fix:** split by responsibility (e.g. dictionary: groups/artists/songs/events/aliases sub-services;
video routes: list/detail/metadata/tags/batch sub-routers).

### C7 — No standardized request validation

`ajv` is already a dependency but is used **only** in `mediaLibrarySchema.service.ts`. API request bodies
are validated ad-hoc and inconsistently per route (some routes have hand-written validators, many do
not).
**Fix:** standardize request validation on `ajv` (already present) via shared schema validators / a
validation middleware — no new dependency needed.

---

## 🟢 Minor

- **C8 — Ad-hoc logging:** ~64 `console.*` calls across `src/` (e.g. 20 in `video.routes.ts`), no
  structured logger; only `morgan` covers HTTP access logs. Introduce a small logger (pino/winston or a
  thin wrapper) for levels, structure, and test-time silencing.
- **C9 — `any` erodes strictness:** `tsconfig` has `strict: true`, yet there are ~67 `: any` / `as any`
  occurrences in non-test code. Reduce them, especially around knex rows and external API payloads.

---

## Tests

`npm test` (Vitest) currently reports **175 failed / 75 passed (250)**. Breakdown by cause:

### C10 — The dead `parser_new` suite is ~97% of the failures

`src/services/parser_new/parser.service.test.ts` accounts for **169 of the 175 failures** — assertion
mismatches against the unused experimental parser (a different output shape
`{ isFancam, group, artist, song, date }`). This is the bulk of "most tests fail". Removing `parser_new`
(see [TASK-9](../TODO.md) / C1) deletes this suite and drops failures from 175 to ~6.

### C11 — No shared test DB bootstrap; schema drift in in-memory tests

`vitest.config.ts` has **no `globalSetup`/`setupFiles`**. Two consequences:

- Tests that exercise the **real `knex` singleton** (e.g. `parser/parser.service.test.ts` → the parser's
  dictionary lookups) need a **migrated + seeded** DB. The test env points at `dev.sqlite3` (shared with
  development — see [migrations-review F2](./migrations-review.md#f2--test-and-development-share-the-same-sqlite-file));
  in a fresh checkout that file is empty, so every such test fails with `no such table: dictionary_groups`.
- Tests that build their **own in-memory schema** hand-roll table definitions that drift from the
  migrations — e.g. `dictionary.routes.test.ts` fails with `no such table: video_songs` (a table added by
  a later migration but missing from the test's manual schema).

**Fix:** add a Vitest `globalSetup` that provisions a dedicated test DB by running `knex.migrate.latest()`
(+ minimal seeds) — ideally one shared migrated SQLite (file or shared `:memory:`) — and have all
DB-touching tests use it instead of hand-built partial schemas. Pairs with
[TASK-5](../TODO.md) (separate test DB).

### C12 — Genuine failures to triage (after C10/C11)

Independent of the infra issues, the active parser has **5 real assertion failures** in
`parser/parser.service.test.ts` (with a seeded DB):

- event normalization keeps `@SBS INKIGAYO` instead of the expected `@INKIGAYO`;
- `camera_type` returns `FANCAM` instead of the expected `페이스캠4K` / `안방1열 직캠4K`;
- song titles split on an apostrophe (`What's a girl to do` → `What`, `Eye-Poppin'` → `Eye-Poppin`);
- solo detection: `DAYOUNG` resolves to group `WJSN` where the test expects `SOLO`.

Plus 1 failure in `video.routes.pagination.test.ts`. Each is either a parser bug or a stale expectation
and must be triaged individually.
