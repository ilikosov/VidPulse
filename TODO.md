# TODO — implementation backlog

Index of code-implementation tasks derived from the project documentation (ADRs and reference docs).
Each task has its own file in [`docs/tasks/`](./docs/tasks) with full context, steps, files, and
acceptance criteria.

**How to use (for Claude Code):**

- Open a task's file (linked below) and read its **Docs** block before starting.
- Status markers here: `[ ]` not started · `[~]` in progress · `[x]` done — keep them in sync with the
  task file's own `Status` line.
- Follow the conventions in [`CLAUDE.md`](./CLAUDE.md) (feature branch, Conventional Commits, thin routes
  / logic in services, migrations via `knex migrate:make`).

## Data model (ADR-0001 / ADR-0002)

- [x] **TASK-1** (high) — Separate raw parse from canonical references (group/artist/event) — [details](./docs/tasks/task-01-raw-vs-canonical.md)
- [x] **TASK-2** (medium) — Extend `video_songs` (`raw_title` + nullable `song_id` + `position`) — [details](./docs/tasks/task-02-extend-video-songs.md)
- [ ] **TASK-3** (low, gated) — Fate of legacy columns `song_id` / `song_title` — [details](./docs/tasks/task-03-legacy-columns.md)

## Migrations & DB hygiene (migrations-review)

- [ ] **TASK-4** (medium) — Remove duplicate indexes on `videos` (superseded by TASK-7 if squashed) — [details](./docs/tasks/task-04-duplicate-indexes.md)
- [ ] **TASK-5** (medium) — Harden `knexfile.ts` (test DB, FK pragma, prod path) — [details](./docs/tasks/task-05-knexfile-hardening.md)
- [ ] **TASK-6** (low) — Move seed data out of migrations into `seeds/` — [details](./docs/tasks/task-06-seeds-extraction.md)
- [ ] **TASK-7** (medium) — Consolidate & harden migrations (squash to a baseline) — [details](./docs/tasks/task-07-migration-robustness.md)

## Repository structure (ADR-0003)

- [ ] **TASK-8** (medium) — Migrate to a proper monorepo (npm workspaces) — [details](./docs/tasks/task-08-monorepo.md)

## Code quality (code-review)

- [x] **TASK-9** (medium) — Remove dead code (`parser_new`) & unused dep (`sqlite3`) — [details](./docs/tasks/task-09-remove-dead-code.md)
- [ ] **TASK-10** (high) — Central error handling, 404, async wrapper — [details](./docs/tasks/task-10-error-handling.md)
- [ ] **TASK-11** (medium) — Side-effect-free app bootstrap — [details](./docs/tasks/task-11-bootstrap-side-effects.md)
- [ ] **TASK-12** (medium) — Consolidate DB access; split god files — [details](./docs/tasks/task-12-consolidate-db-access.md)
- [ ] **TASK-13** (medium) — Standardize request validation (ajv) — [details](./docs/tasks/task-13-request-validation.md)
- [ ] **TASK-14** (low) — Observability & type-safety polish — [details](./docs/tasks/task-14-observability-types.md)

## Tests (code-review)

- [x] **TASK-15** (high) — Fix the test suite (DB bootstrap, schema drift, real failures) — [details](./docs/tasks/task-15-fix-tests.md)
- [ ] **TASK-16** (medium) — Fix parser correctness bugs (apostrophe truncation, name split, solo detection) — [details](./docs/tasks/task-16-parser-correctness.md)

---

> **Background docs.** Findings behind TASK-4…7 → [`docs/migrations-review.md`](./docs/migrations-review.md);
> behind TASK-9…16 → [`docs/code-review.md`](./docs/code-review.md). Design decisions →
> [`docs/adr/`](./docs/adr).
