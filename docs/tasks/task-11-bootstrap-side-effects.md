# TASK-11 — Side-effect-free app bootstrap

**Status:** [x] done
**Priority:** medium
**Docs:** [Code review → C4](../code-review.md#c4--import-time-side-effects-in-srcindexts)

**Why:** `createAppContainer()` (opens DB) and `app.listen()` + `runScheduler()` run at import time, so
importing the app for in-process tests opens a connection and binds a port. Also helps the monorepo move
([ADR 0003](../adr/0003-monorepo.md)).

**Steps:**

- [ ] Export an app/container factory (e.g. `createApp()`); keep route wiring pure (no listen/connect).
- [ ] Guard `app.listen()` and `container.syncService.runScheduler()` behind `if (require.main === module)`.
- [ ] Add an in-process integration test that imports the app without starting a server.

**Files:** `src/index.ts`, `src/compositionRoot.ts`, `tests/`.

**Acceptance:** importing the app has no side effects (no port bind, no scheduler); `npm start` still runs
the server; an in-process app test exists and is green.

---

← back to [TODO](../../TODO.md)
