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

> **Note.** Technical findings from the migrations review (duplicate indexes on `videos.status` /
> `duplicate_group_id`, the shared dev/test SQLite DB, an explicit `PRAGMA foreign_keys=ON` in
> `afterCreate`) are **not yet captured in the documentation**, so they are not tracked here as tasks.
> If wanted, I can add a separate doc/section and create TODO entries for them.
