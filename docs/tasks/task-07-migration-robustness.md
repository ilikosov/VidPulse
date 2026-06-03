# TASK-7 — Minor migration robustness (CHECK portability, updated_at, types)

**Status:** [ ] not started
**Priority:** low
**Docs:** [Migrations review → F5](../migrations-review.md#f5--alter-table--add-constraint-check-is-non-standard-sqlite),
[F6](../migrations-review.md#f6--updated_at-is-not-auto-updated),
[F7](../migrations-review.md#-minor), [F9](../migrations-review.md#-minor)

**Why:** small correctness/consistency improvements surfaced by the review.

**Steps:**

- [ ] Define the `dictionary_artist_memberships` CHECK constraints inside `createTable` instead of
      `ALTER TABLE … ADD CONSTRAINT` (non-standard SQLite syntax; portability risk).
- [ ] Decide on `updated_at` freshness: add an UPDATE trigger, or enforce repositories set it explicitly.
- [ ] (Optional) Normalize `string()` vs `text()` usage for consistency.
- [ ] (F9) De-duplicate the `'private'` tag seed — it is inserted in both
      `20260428123000_add_tags_and_video_duration.ts` and `20260428143000_ensure_private_tag.ts`
      (harmless due to the unique constraint / `INSERT OR IGNORE`, but redundant); fold into the seeds
      work from [TASK-6](./task-06-seeds-extraction.md).

**Files:** `migrations/`, `src/repositories/**` (if enforcing `updated_at` in code).

**Acceptance:** CHECK constraints defined at table creation; `updated_at` behavior is defined and tested;
migrations apply and roll back cleanly.

---

← back to [TODO](../../TODO.md)
