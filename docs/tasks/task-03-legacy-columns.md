# TASK-3 — (gated) Fate of legacy columns `videos.song_id` / `song_title` (and optionally `*_name`)

**Status:** [x] done — dropped `videos.song_id` + `song_title` (migration with reversible `down` that
restores from `video_songs`); `videos_display` view, `getStats`, list serialization and all write paths
no longer reference them; `*_name` kept (raw evidence). Tests green.
**Priority:** low · **Blocked by:** [TASK-1](./task-01-raw-vs-canonical.md), [TASK-2](./task-02-extend-video-songs.md)
**Docs:**

- [ADR 0001 §4 Phase C/D + §5 Rollback](../adr/0001-canonical-dictionary-entities.md)
- [Entity Unification: Final Migration Readiness](../entity-unification-final-migration.md)
- [Entity Unification: Audit](../entity-unification-audit.md)

**Why:** once raw+FK+display is stable and songs are moved into `video_songs`, the single-value legacy
columns become redundant. Removal is **destructive** — do it only behind the readiness gate from the docs.

**Steps:**

- [x] Readiness audit (dependency map of legacy-column readers/writers) — no live data on this
      checkout, so metrics N/A; instead audited & migrated every reference. Original step:
      Collect `videos.*_id` fill metrics (SQL from final-migration §2) and reach the thresholds (§Phase A).
- [x] Confirmed no read path depends on the legacy columns (view/getStats/serialization/backfill updated).
- [x] Destructive migration `20260519100000_drop_videos_legacy_song_columns` (reversible `down`), applied after explicit approval.

**Acceptance:** columns removed, app and tests green; backup/rollback plan in place.

---

← back to [TODO](../../TODO.md)
