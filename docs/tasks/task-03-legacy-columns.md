# TASK-3 — (gated) Fate of legacy columns `videos.song_id` / `song_title` (and optionally `*_name`)

**Status:** [ ] not started
**Priority:** low · **Blocked by:** [TASK-1](./task-01-raw-vs-canonical.md), [TASK-2](./task-02-extend-video-songs.md)
**Docs:**

- [ADR 0001 §4 Phase C/D + §5 Rollback](../adr/0001-canonical-dictionary-entities.md)
- [Entity Unification: Final Migration Readiness](../entity-unification-final-migration.md)
- [Entity Unification: Audit](../entity-unification-audit.md)

**Why:** once raw+FK+display is stable and songs are moved into `video_songs`, the single-value legacy
columns become redundant. Removal is **destructive** — do it only behind the readiness gate from the docs.

**Steps:**

- [ ] Collect `videos.*_id` fill metrics (SQL from final-migration §2) and reach the thresholds (§Phase A).
- [ ] Confirm no read path depends on the legacy columns directly (everything via display/FK/`video_songs`).
- [ ] Separate destructive migration (rename-before-drop), apply only after explicit approval.

**Acceptance:** columns removed, app and tests green; backup/rollback plan in place.

---

← back to [TODO](../../TODO.md)
