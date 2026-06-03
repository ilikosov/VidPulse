# TASK-6 — Move seed data out of migrations into `seeds/`

**Status:** [ ] not started
**Priority:** low
**Docs:** [Migrations review → F3](../migrations-review.md#f3--schema-and-seed-data-mixed-in-migrations)

**Why:** dictionary/tags/settings seed data is embedded in migrations
(`20260504110000_dictionary_db.ts`, `20260428123000_add_tags_and_video_duration.ts`,
`20260428143000_ensure_private_tag.ts`), with hard-coded Russian tag strings and hand-rolled `esc()`
string-interpolation inserts.

**Steps:**

- [ ] Move seed inserts (groups, artists, events, tags, settings) into Knex `seeds/`.
- [ ] Use parameterized `knex(...).insert({...})` instead of `esc()` raw interpolation.
- [ ] De-hardcode UI tag strings (`'длинное видео'`, `'игнорировать видео'`) — drive from config/i18n.
- [ ] Keep migrations structure-only; ensure a documented bootstrap path still seeds a fresh DB.

**Files:** `migrations/`, new `seeds/`.

**Acceptance:** migrations contain no seed inserts; `seeds/` reproduces the reference data; fresh-DB
bootstrap documented and working.

---

← back to [TODO](../../TODO.md)
