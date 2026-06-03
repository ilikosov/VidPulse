# TASK-7 — Consolidate & harden migrations (squash to a baseline)

**Status:** [ ] not started
**Priority:** medium
**Docs:** [Migrations review](../migrations-review.md) —
[F1](../migrations-review.md#f1--duplicate-indexes-on-videos),
[F3](../migrations-review.md#f3--schema-and-seed-data-mixed-in-migrations),
[F5](../migrations-review.md#f5--alter-table--add-constraint-check-is-non-standard-sqlite),
[F6](../migrations-review.md#f6--updated_at-is-not-auto-updated),
[F7](../migrations-review.md#-minor), [F9](../migrations-review.md#-minor)

**Why:** the history has grown to ~18 incremental migrations with accumulated cruft, and the **`down`
path is broken end-to-end** — a full `knex migrate:rollback` fails because an old `down()` (e.g.
`add_video_description`) rebuilds `videos` and references tables a younger migration already dropped
(observed while testing TASK-1). It's a pet project with no production data to preserve, so squashing the
history into a **single baseline migration** is the simplest fix — and the rewrite naturally folds in the
small per-migration robustness items below.

**Steps:**

- [ ] **Squash to a baseline.** Generate the current schema and replace `migrations/*` with one baseline
      migration (clean `up` that builds the whole schema + a working `down`). Keep
      `migrate:latest`/`rollback` green on a clean DB. (Optionally keep a dated `legacy/` copy for
      reference.)
- [ ] While rewriting the baseline, fold in:
  - **(F1)** drop the duplicate raw `idx_videos_*` indexes — one index per column (supersedes
    [TASK-4](./task-04-duplicate-indexes.md)).
  - **(F5)** define the `dictionary_artist_memberships` CHECK constraints **inside `createTable`**, not
    via `ALTER TABLE … ADD CONSTRAINT` (non-standard SQLite).
  - **(F7)** normalize `string()` vs `text()` usage.
  - **(F9)** seed the `'private'` tag once (no duplicate insert across two migrations).
- [ ] **(F6)** Decide `updated_at` freshness: add an UPDATE trigger in the baseline, or enforce that
      repositories set it explicitly.
- [ ] **Seeds:** move reference/seed data out of the baseline into `seeds/` (coordinate with
      [TASK-6](./task-06-seeds-extraction.md)); the baseline stays structure-only.

**Files:** `migrations/`, new `seeds/`, `src/repositories/**` (if enforcing `updated_at` in code).

**Acceptance:** a single baseline migration builds the full schema; `migrate:latest` **and**
`migrate:rollback` are green on a clean DB; duplicate indexes gone; CHECK constraints defined at table
creation; `updated_at` behavior defined; seeds live in `seeds/`; `npm test` green.

**Notes:** coordinate ordering with [TASK-8 (monorepo)](./task-08-monorepo.md) — do the squash either
before the move or right after, to avoid rewriting migration paths twice. Supersedes TASK-4 and overlaps
TASK-6.

---

← back to [TODO](../../TODO.md)
