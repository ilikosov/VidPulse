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
- [x] **TASK-3** (low, gated) — Fate of legacy columns `song_id` / `song_title` — [details](./docs/tasks/task-03-legacy-columns.md)

## Migrations & DB hygiene (migrations-review)

- [x] **TASK-7** (medium) — Consolidate & harden migrations (squash to a baseline)
- [x] **TASK-17** (low) — Populate a development seed dataset

## Code quality (code-review)

- [x] **TASK-9** (medium) — Remove dead code (`parser_new`) & unused dep (`sqlite3`) — [details](./docs/tasks/task-09-remove-dead-code.md)
- [x] **TASK-12** (medium) — Consolidate DB access; split god files
- [x] **TASK-13** (medium) — Standardize request validation (ajv) — [details](./docs/tasks/task-13-request-validation.md)

## Tests (code-review)

- [x] **TASK-15** (high) — Fix the test suite (DB bootstrap, schema drift, real failures) — [details](./docs/tasks/task-15-fix-tests.md)

## Features

- [ ] **TASK-20** (low) — List-level `reparse` / `resync`. These re-parse titles and can
      split a list's status (`needs_review` vs `new`), breaking the single-status invariant.
      Decide a UX (e.g. re-bucket diverged videos out of the list, or relax the invariant for
      this op) before exposing them in `videoListService.batchOperation`.

---

> **Background docs.** Findings behind TASK-4…7 → [`docs/migrations-review.md`](./docs/migrations-review.md);
> behind TASK-9…16 → [`docs/code-review.md`](./docs/code-review.md). Design decisions →
> [`docs/adr/`](./docs/adr).
