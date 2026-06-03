# TASK-12 — Consolidate DB access into services/repositories; split god files

**Status:** [ ] not started
**Priority:** medium
**Docs:** [Code review → C5](../code-review.md#c5--data-access-in-routes-bypasses-the-servicerepository-layer),
[C6](../code-review.md#c6--god-files)

**Why:** routes import `knex` and query inline (e.g. `src/routes/video.routes.ts`), bypassing
services/`repositories/` (a single file used only by `compositionRoot`); `dictionary.service.ts` (1620
LOC) and `video.routes.ts` (1213 LOC) are god files. Contradicts the layered design in `CLAUDE.md`.

**Steps:**

- [ ] Move DB access out of routes into services/repositories; keep routes thin (validate input → call
      service → format response).
- [ ] Split `dictionary.service.ts` by entity (groups/artists/songs/events/aliases) and
      `video.routes.ts` into sub-routers (list/detail/metadata/tags/batch).
- [ ] Establish a consistent repository pattern (extend `src/repositories/knex.repositories.ts`).

**Files:** `src/routes/**`, `src/services/dictionary.service.ts`, `src/repositories/**`.

**Acceptance:** routes contain no direct `knex` queries; the two god files are split into focused modules;
behavior unchanged; `npm test` green. (Best done after [TASK-8](./task-08-monorepo.md) to avoid double
path churn.)

---

← back to [TODO](../../TODO.md)
