# TASK-2 — Extend `video_songs` (raw_title + nullable song_id + position) and move song resolution there

**Status:** [x] done — `video_songs` rebuilt (`raw_title` + `position` + nullable `song_id`, PK
`(video_id, position)`); `syncVideoSongs` matches the curated dictionary (no auto-create) and stores raw

- order; `getVideoSongsMap` returns position-ordered display titles incl. unmatched; migration backfills
  existing rows + the legacy `videos.song_title`. (The `is_own_*` flag move is optional — left on `videos`.)
  **Priority:** medium
  **Docs:**

* [ADR 0002 §2 "Songs (important caveat)"](../adr/0002-raw-parse-vs-canonical-display.md)
* [ADR 0001 / Update on M:N](../adr/0001-canonical-dictionary-entities.md)
* [Entities & Relationships → `video_songs`](../entities.en.md)

**Why:** a video can have several songs; today unmatched songs "fall through" (`video_songs` holds only
matched ones), and `videos.song_title/song_id` is a single legacy snapshot. Goal: `video_songs` stores
both the raw and the canonical, covering all songs.

**Steps:**

- [x] Migration: add `raw_title TEXT` to `video_songs`, make `song_id` nullable, add `position INTEGER`;
      reconsider the PK (currently `(video_id, song_id)` → e.g. `(video_id, position)`, since `song_id`
      may be NULL). See the current migration `migrations/20260516100000_create_videos_songs.ts`.
- [x] `src/services/parser/videoSongs.service.ts` (+ `songTitles.util.ts`): write each parsed song as a
      `video_songs` row with `raw_title` and, when matched, `song_id`; preserve order (`position`).
- [x] Display of a song = `COALESCE(ds.title, raw_title)`; update reads in `dictionary.service.ts`
      (`getVideosBySongId`, etc.).
- [~] (optional, deferred) Consider moving the `is_own_group_song` / `is_own_artist_song` flags from `videos` to the
  `video_songs` row (with multiple songs they are ambiguous at the video level).
- [x] Backfill: migrate existing `videos.song_title/song_id` into `video_songs` as `position=0`.

**Files:** `migrations/`, `src/services/parser/videoSongs.service.ts`,
`src/services/parser/songTitles.util.ts`, `src/services/dictionary.service.ts`.

**Acceptance:** a video with multiple songs (including unmatched ones) stores and returns the full set
correctly; tests `videoSongs.service.test.ts` updated and green.

**Depends on:** preferably after [TASK-1](./task-01-raw-vs-canonical.md) (shared display approach).

---

← back to [TODO](../../TODO.md)
