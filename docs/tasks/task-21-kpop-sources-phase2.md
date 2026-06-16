# TASK-21 — K-pop sources phase 2 (songs + solo artists)

- **Status:** [~] in progress — songs (MusicBrainz) done; solo artists remaining
- **Priority:** medium
- **Related:** [ADR 0004](../adr/0004-kpop-data-sources.md),
  [ADR 0005](../adr/0005-musicbrainz-song-source.md), `packages/kpop-sources`

## Context

Phase 1 (`@vidpulse/kpop-sources`) sources **groups + members + aliases + type + active** from
Wikidata and feeds `MediaLibraryService.importMediaLibrary` via `kpopDictionaryService.refresh()`.
Wikidata only has title tracks/singles as standalone items; full track-lists and solo artists were
not yet sourced (events stay seeded manually).

## Scope

1. **Songs / discography (MusicBrainz):** ✅ **done** (ADR 0005). `MusicBrainzSource` enriches each
   group's `songs[]` with its full recording list, bridged via the group's Wikidata MusicBrainz id
   (P434). Opt-in via `MUSICBRAINZ_REFRESH_ENABLED`, throttled to ≤1 req/s, fixture-based tests.
2. **Solo artists (Wikidata):** ⬜ humans with genre P136 = K-pop who are not (only) band members
   → `soloArtists[]` with Korean aliases and a `solo` membership.

## Steps

- [x] `MusicBrainzSource` adapter (client + normalize) mirroring `WikidataSource`, injectable fetch.
- [x] Wikidata groups query fetches P434 (`?mbid`); `normalizeGroups` carries it as a runtime field
      stripped before the snapshot.
- [x] Wire opt-in MusicBrainz enrichment into `buildKpopLibrary` + `kpopDictionaryService.refresh()`.
- [x] Config/env + docs (ADR 0005, `.env.example`); rate-limiting documented.
- [ ] Solo artists from Wikidata → `soloArtists[]`.

## Acceptance

- `buildKpopLibrary` optionally enriches songs from MusicBrainz behind a flag — **met**.
- Unit tests on fixtures (no network) — **met** for songs.
- Solo artists sourced and landed on a test-DB refresh — **pending**.
