# TASK-1 — Variant 1: separate raw parse from canonical references (group / artist / event)

**Status:** [~] in progress — core implemented (resolver raw storage + `videos_display` view +
read-path joins + list/detail reads + tests). Remaining: `videos_perf_meta_idx` review;
post-mutation route responses; optional `getVideosBy*Id` COALESCE for secondary fields.
**Priority:** high
**Docs:**

- [ADR 0002 — Raw parse vs canonical references](../adr/0002-raw-parse-vs-canonical-display.md) (especially §2 Decision and §4 Implementation plan)
- [ADR 0001 — Canonical dictionary entities](../adr/0001-canonical-dictionary-entities.md)
- [Entities & Relationships](../entities.en.md) → `videos` section, "Target denormalization model" note

**Why:** today `videos.group_name/artist_name/event` and the FKs `group_id/artist_id/event_id` are a
dual source of truth (the text is overwritten with the canonical value → staleness when a dictionary
entry is renamed + loss of the parse result). Goal: text holds only the raw parse result, the FK is the
canonical link, and the display value is derived as `COALESCE(dictionary, parse)` (dictionary wins).

**Steps:**

- [x] **Resolver** `src/services/parser/metadataResolver.service.ts` (~lines 106–109): stop overwriting
      `*_name` with the canonical value — write the raw parse (`groupInput || null`) into `*_name` and the
      resolved id into `*_id`. Update tests `metadataResolver.service.test.ts`.
- [x] **Display layer:** add a SQL VIEW `videos_display` (or a single query helper) computing
      `group_display = COALESCE(dg.name, videos.group_name)` and likewise for artist/event
      (event with `@` normalization). New migration via `npx knex migrate:make add_videos_display_view`.
- [x] **Read path** `src/services/dictionary.service.ts`: replace the fragile `OR` join
      (`ON v.group_id = g.id OR v.group_name = g.name`, ~line 404) and the text join in `getVideosByField`
      (~line 596) with FK-only joins; switch video reads/serialization to `videos_display`/the helper.
- [~] **Consumer routes:** check `src/routes/{video,parser,channel,playlist,dictionary}.routes.ts` — return
  the display fields.
- [ ] **Index:** reconsider the composite `videos_perf_meta_idx` (`perf_date, group_name, artist_name,
song_title, event`) — decide whether to keep it for text search or replace with `*_id` indexes
      (see ADR 0002 §3 Trade-offs).
- [x] **Backfill (idempotent):** no-op — the view derives display from the dictionary, so existing rows
      (where the stored text already equals the canonical name) display identically; no data migration
      needed (see ADR 0002 §3 Risks: the original raw parse is unrecoverable for historical rows).
- [x] **Frontend** — no change needed: the API reuses the existing field names (`group_name`/…),
      now carrying the display value, so the client is untouched.

**Files:** `src/services/parser/metadataResolver.service.ts`, `src/services/dictionary.service.ts`,
`src/routes/*.routes.ts`, `migrations/`, `client/src/**`.

**Acceptance:**

- After renaming a `dictionary_*` entry, the video's display value changes **immediately**, while the
  text evidence field (`*_name`) does not.
- No text/`OR` joins remain in the read path; joins are FK-only.
- `npm test` and `npm run test:e2e` are green; a test is added for "rename a dictionary entry → display
  updates, evidence preserved".

**Out of scope:** songs (see [TASK-2](./task-02-extend-video-songs.md)), removing legacy columns
(see [TASK-3](./task-03-legacy-columns.md)).

---

← back to [TODO](../../TODO.md)
