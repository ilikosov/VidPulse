# TODO — implementation backlog

This file is the queue of **code implementation** tasks derived from the project documentation
(ADRs and reference docs). The docs describe _what & why_; this file is _what to do_.

**How to use (for Claude Code):**

- Each task is self-contained: context, doc links, concrete steps, files, acceptance criteria.
- Before starting a task, read the linked docs in its **Docs** block.
- Checkbox states: `[ ]` not started · `[~]` in progress · `[x]` done.
- Follow the conventions in [`AGENTS.md`](./AGENTS.md) (feature branch, Conventional Commits, thin routes / logic in services, migrations via `knex migrate:make`).
- **Only the documentation is fixed so far — code/schema changes happen through these tasks.**

---

## [ ] TASK-1 — Variant 1: separate raw parse from canonical references (group / artist / event)

**Priority:** high
**Docs:**

- [ADR 0002 — Raw parse vs canonical references](./docs/adr/0002-raw-parse-vs-canonical-display.md) (especially §2 Decision and §4 Implementation plan)
- [ADR 0001 — Canonical dictionary entities](./docs/adr/0001-canonical-dictionary-entities.md)
- [Entities & Relationships](./docs/entities.en.md) → `videos` section, "Target denormalization model" note

**Why:** today `videos.group_name/artist_name/event` and the FKs `group_id/artist_id/event_id` are a
dual source of truth (the text is overwritten with the canonical value → staleness when a dictionary
entry is renamed + loss of the parse result). Goal: text holds only the raw parse result, the FK is the
canonical link, and the display value is derived as `COALESCE(dictionary, parse)` (dictionary wins).

**Steps:**

- [ ] **Resolver** `src/services/parser/metadataResolver.service.ts` (~lines 106–109): stop overwriting
      `*_name` with the canonical value — write the raw parse (`groupInput || null`) into `*_name` and the
      resolved id into `*_id`. Update tests `metadataResolver.service.test.ts`.
- [ ] **Display layer:** add a SQL VIEW `videos_display` (or a single query helper) computing
      `group_display = COALESCE(dg.name, videos.group_name)` and likewise for artist/event
      (event with `@` normalization). New migration via `npx knex migrate:make add_videos_display_view`.
- [ ] **Read path** `src/services/dictionary.service.ts`: replace the fragile `OR` join
      (`ON v.group_id = g.id OR v.group_name = g.name`, ~line 404) and the text join in `getVideosByField`
      (~line 596) with FK-only joins; switch video reads/serialization to `videos_display`/the helper.
- [ ] **Consumer routes:** check `src/routes/{video,parser,channel,playlist,dictionary}.routes.ts` — return
      the display fields.
- [ ] **Index:** reconsider the composite `videos_perf_meta_idx` (`perf_date, group_name, artist_name,
song_title, event`) — decide whether to keep it for text search or replace with `*_id` indexes
      (see ADR 0002 §3 Trade-offs).
- [ ] **Backfill (idempotent):** for rows where the text already equals the canonical value there is no
      change; record current behavior as the baseline (see ADR 0002 §4 step 4 and §3 Risks about the raw
      parse being unrecoverable for historical rows).
- [ ] **Frontend** (`client/`): read the display field instead of the raw `*_name`.

**Files:** `src/services/parser/metadataResolver.service.ts`, `src/services/dictionary.service.ts`,
`src/routes/*.routes.ts`, `migrations/`, `client/src/**`.

**Acceptance:**

- After renaming a `dictionary_*` entry, the video's display value changes **immediately**, while the
  text evidence field (`*_name`) does not.
- No text/`OR` joins remain in the read path; joins are FK-only.
- `npm test` and `npm run test:e2e` are green; a test is added for "rename a dictionary entry → display
  updates, evidence preserved".

**Out of scope:** songs (see TASK-2), removing legacy columns (see TASK-3).

---

## [ ] TASK-2 — Extend `video_songs` (raw_title + nullable song_id + position) and move song resolution there

**Priority:** medium
**Docs:**

- [ADR 0002 §2 "Songs (important caveat)"](./docs/adr/0002-raw-parse-vs-canonical-display.md)
- [ADR 0001 / Update on M:N](./docs/adr/0001-canonical-dictionary-entities.md)
- [Entities & Relationships → `video_songs`](./docs/entities.en.md)

**Why:** a video can have several songs; today unmatched songs "fall through" (`video_songs` holds only
matched ones), and `videos.song_title/song_id` is a single legacy snapshot. Goal: `video_songs` stores
both the raw and the canonical, covering all songs.

**Steps:**

- [ ] Migration: add `raw_title TEXT` to `video_songs`, make `song_id` nullable, add `position INTEGER`;
      reconsider the PK (currently `(video_id, song_id)` → e.g. `(video_id, position)`, since `song_id`
      may be NULL). See the current migration `migrations/20260516100000_create_videos_songs.ts`.
- [ ] `src/services/parser/videoSongs.service.ts` (+ `songTitles.util.ts`): write each parsed song as a
      `video_songs` row with `raw_title` and, when matched, `song_id`; preserve order (`position`).
- [ ] Display of a song = `COALESCE(ds.title, raw_title)`; update reads in `dictionary.service.ts`
      (`getVideosBySongId`, etc.).
- [ ] Consider moving the `is_own_group_song` / `is_own_artist_song` flags from `videos` to the
      `video_songs` row (with multiple songs they are ambiguous at the video level).
- [ ] Backfill: migrate existing `videos.song_title/song_id` into `video_songs` as `position=0`.

**Files:** `migrations/`, `src/services/parser/videoSongs.service.ts`,
`src/services/parser/songTitles.util.ts`, `src/services/dictionary.service.ts`.

**Acceptance:** a video with multiple songs (including unmatched ones) stores and returns the full set
correctly; tests `videoSongs.service.test.ts` updated and green.

**Depends on:** preferably after TASK-1 (shared display approach).

---

## [ ] TASK-3 — (gated) Fate of legacy columns `videos.song_id` / `song_title` (and optionally `*_name`)

**Priority:** low · **Blocked by:** TASK-1, TASK-2
**Docs:**

- [ADR 0001 §4 Phase C/D + §5 Rollback](./docs/adr/0001-canonical-dictionary-entities.md)
- [Entity Unification: Final Migration Readiness](./docs/entity-unification-final-migration.md)
- [Entity Unification: Audit](./docs/entity-unification-audit.md)

**Why:** once raw+FK+display is stable and songs are moved into `video_songs`, the single-value legacy
columns become redundant. Removal is **destructive** — do it only behind the readiness gate from the docs.

**Steps:**

- [ ] Collect `videos.*_id` fill metrics (SQL from final-migration §2) and reach the thresholds (§Phase A).
- [ ] Confirm no read path depends on the legacy columns directly (everything via display/FK/`video_songs`).
- [ ] Separate destructive migration (rename-before-drop), apply only after explicit approval.

**Acceptance:** columns removed, app and tests green; backup/rollback plan in place.

---

## [ ] TASK-4 — Remove duplicate indexes on `videos`

**Priority:** medium
**Docs:** [Migrations review → F1](./docs/migrations-review.md#f1--duplicate-indexes-on-videos)

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

## [ ] TASK-5 — Harden `knexfile.ts` (test DB, FK pragma, prod path)

**Priority:** medium
**Docs:** [Migrations review → F2](./docs/migrations-review.md#f2--test-and-development-share-the-same-sqlite-file),
[F4](./docs/migrations-review.md#f4--fk-enforcement-relies-on-the-driver-default),
[F8](./docs/migrations-review.md#-minor)

**Why:** `test` and `development` share `dev.sqlite3` (risk of corrupting dev data under
`NODE_ENV=test`); FK enforcement relies on the `better-sqlite3` default because `afterCreate` never sets
`foreign_keys`; `production.filename` is cwd-relative while dev/test use `path.resolve`.

**Steps:**

- [ ] Point the `test` env at a separate file or `:memory:`; give it the same `pool.afterCreate` pragmas.
- [ ] Add `conn.pragma('foreign_keys = ON')` to every env's `afterCreate`.
- [ ] Resolve `production.filename` via `path.resolve(__dirname, …)` for cwd-independence.

**Files:** `src/db/knexfile.ts`.

**Acceptance:** test runs never touch `dev.sqlite3`; FK constraints enforced regardless of driver
default; prod path is cwd-independent; `npm test` green.

---

## [ ] TASK-6 — Move seed data out of migrations into `seeds/`

**Priority:** low
**Docs:** [Migrations review → F3](./docs/migrations-review.md#f3--schema-and-seed-data-mixed-in-migrations)

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

## [ ] TASK-7 — Minor migration robustness (CHECK portability, updated_at, types)

**Priority:** low
**Docs:** [Migrations review → F5](./docs/migrations-review.md#f5--alter-table--add-constraint-check-is-non-standard-sqlite),
[F6](./docs/migrations-review.md#f6--updated_at-is-not-auto-updated),
[F7](./docs/migrations-review.md#-minor)

**Why:** small correctness/consistency improvements surfaced by the review.

**Steps:**

- [ ] Define the `dictionary_artist_memberships` CHECK constraints inside `createTable` instead of
      `ALTER TABLE … ADD CONSTRAINT` (non-standard SQLite syntax; portability risk).
- [ ] Decide on `updated_at` freshness: add an UPDATE trigger, or enforce repositories set it explicitly.
- [ ] (Optional) Normalize `string()` vs `text()` usage for consistency.

**Files:** `migrations/`, `src/repositories/**` (if enforcing `updated_at` in code).

**Acceptance:** CHECK constraints defined at table creation; `updated_at` behavior is defined and tested;
migrations apply and roll back cleanly.

---

## [ ] TASK-8 — Migrate to a proper monorepo

**Priority:** medium
**Docs:** ADR-0003 (to be created — see step 1)

**Why:** the repo is already two npm packages — backend at the root (`package.json`,
`kpop-archive-manager`) and frontend in `client/` — but without a workspace manager. Consequences today:
no single install, scripts shell out with `cd client && …` and `concurrently` (see root `package.json`
`client:dev`/`client:build`/`launch`/`dev:all`), two independent `tsconfig.json`, and no shared package,
so API/domain types are duplicated between backend (`src/interfaces`, `src/types`) and frontend
(`client/src`). A real monorepo gives one install, shared types, and unified tooling.

**Steps:**

- [ ] **Decide & record:** write `docs/adr/0003-monorepo.md` (Status: Proposed) choosing the tool
      (npm workspaces vs pnpm vs Turborepo/Nx) and the target layout, e.g.
      `apps/server` + `apps/web` + `packages/shared` (shared types/contracts).
- [ ] **Restructure:** move backend (`src/`, `migrations/`, `tests/`, configs) into `apps/server` and the
      current `client/` into `apps/web`; keep import paths working.
- [ ] **Workspaces:** add `"workspaces"` (or `pnpm-workspace.yaml`) at the root; `private: true`; one
      lockfile; a single `npm install` bootstraps everything.
- [ ] **Shared package:** extract cross-cutting types/contracts (API DTOs, dictionary/video shapes) into
      `packages/shared` consumed by both apps — remove duplication.
- [ ] **Scripts:** replace `cd client && …` / `concurrently` plumbing with workspace-aware scripts
      (`npm run -w apps/web …`, root `dev`/`build`/`test` fan-out). Keep `dev:all` working.
- [ ] **Tooling:** root-level `tsconfig` base + per-app extends; align Prettier/Husky/lint-staged,
      Vitest and Playwright paths.
- [ ] **CI/docs:** update [`docs/overview.*`](./docs/overview.en.md) project-structure section,
      `AGENTS.md`, and any path assumptions (e.g. `--knexfile` path, Playwright `webServer`).

**Files:** repo root (`package.json`, lockfile, `tsconfig.json`), `src/**` → `apps/server/**`,
`client/**` → `apps/web/**`, new `packages/shared/**`, `playwright.config.ts`, `vitest.config.ts`,
`docs/**`, `AGENTS.md`.

**Acceptance:** a single `npm install` at the root bootstraps both apps; shared types are imported from
`packages/shared` (no duplication); `npm run dev:all`, `npm test`, `npm run test:e2e` and the build all
work from the root; project structure docs updated.

**Notes:** large, mechanical-but-wide change — do it as its own PR, ideally before the schema/data-model
tasks land to avoid path churn. Re-resolve any open work on top of the new layout.

---

> **Note.** The technical findings above (TASK-4…7) are documented in
> [`docs/migrations-review.md`](./docs/migrations-review.md).
