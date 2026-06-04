# TASK-17 — Populate a development seed dataset

**Status:** [ ] not started
**Priority:** low
**Docs:**

- [Entities & Relationships → Dictionary](../entities.en.md)
- [Media Library JSON](../media-library-json.md)
- Related: [TASK-6](./task-06-seeds-extraction.md) (moves the existing inline seeds into `seeds/`)

**Why:** a fresh `dev.sqlite3` only has whatever the migrations seed (a handful of groups/events). For
useful local development, review-queue testing, and parser/dictionary matching, the curated dictionary
should be populated with a representative dataset (groups, their artists, songs, events, and aliases incl.
Korean/English variants). This is about **content**, not the mechanical move done by TASK-6.

**Steps:**

- [ ] Assemble a curated seed dataset: dictionary groups (with `type`/`active`), artists + group
      memberships, songs (with song↔artist/group links), events, and `dictionary_aliases` (Korean/English
      alternates) — enough breadth to exercise parsing/resolution realistically.
- [ ] Express it as Knex `seeds/` (idempotent: upsert by name/alias, safe to re-run) — ideally sourced
      from a versioned data file (e.g. a media-library JSON, see `docs/media-library-json.md`) rather than
      hard-coded inline.
- [ ] Add an npm script (e.g. `npm run seed`) and wire seeding into `dev:all` / document it in the
      overview so a fresh checkout gets a usable dictionary.
- [ ] Keep it dev-only: do not auto-run seeds in `test` (the suite provisions its own DB) or `production`.

**Files:** `seeds/`, `package.json` (scripts), `docs/overview.*` (bootstrap docs), optional
`data/`/`examples/` source file.

**Acceptance:** running the seed command on a fresh DB yields a representative curated dictionary;
idempotent on re-run; `dev:all` documents/produces a usable dataset; tests unaffected.

**Depends on:** [TASK-6](./task-06-seeds-extraction.md) (or [TASK-7](./task-07-migration-robustness.md))
for the `seeds/` setup.

---

← back to [TODO](../../TODO.md)
