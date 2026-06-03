# TASK-4 — Remove duplicate indexes on `videos`

**Status:** [ ] not started
**Priority:** medium
**Docs:** [Migrations review → F1](../migrations-review.md#f1--duplicate-indexes-on-videos)

**Why:** `videos.status` and `videos.duplicate_group_id` are each indexed twice — once by the schema
builder and once by raw `CREATE INDEX` in `migrations/20260423161338_create_tables.ts`. Verified on a
built DB: `idx_videos_status` + `videos_status_index` and `idx_videos_duplicate_group` +
`videos_duplicate_group_id_index` both exist. Redundant write overhead and storage.

**Steps:**

- [ ] New migration `npx knex migrate:make drop_duplicate_video_indexes` that `DROP INDEX IF EXISTS
  idx_videos_status` and `idx_videos_duplicate_group` (keep the builder-created `videos_*_index`).
- [ ] Add a matching `down` that recreates them.

**Files:** `migrations/`.

**Acceptance:** each of `status` / `duplicate_group_id` has exactly one index; migrations apply and roll
back cleanly; `npm test` green.

---

← back to [TODO](../../TODO.md)
