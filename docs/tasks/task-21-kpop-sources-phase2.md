# TASK-21 — K-pop sources phase 2 (songs + solo artists)

- **Status:** [ ] not started
- **Priority:** medium
- **Related:** [ADR 0004](../adr/0004-kpop-data-sources.md), `packages/kpop-sources`

## Context

Phase 1 (`@vidpulse/kpop-sources`) sources **groups + members + aliases + type + active** from
Wikidata and feeds `MediaLibraryService.importMediaLibrary` via `kpopDictionaryService.refresh()`.
Songs, solo artists, and events are not yet sourced (events stay seeded manually).

## Scope

1. **Solo artists (Wikidata):** humans with genre P136 = K-pop (Q213714) who are not (only) band
   members → `soloArtists[]` with Korean aliases and a `solo` membership.
2. **Songs / discography (MusicBrainz):** for each group/artist, fetch recordings/works
   (CC0 data, **1 req/s** rate limit, descriptive User-Agent required) → `songs[]` with aliases,
   linked to the group/artist. Add a `MusicBrainzSource` adapter mirroring `WikidataSource`
   (injectable `fetchImpl`, fixture-based tests).

## Notes

- Keep the same snapshot contract (`MediaLibrarySnapshot`) and `merge` import.
- Respect MusicBrainz rate limits (throttle); cache where sensible.
- Egress: `musicbrainz.org` must be allowlisted in the environment (like `query.wikidata.org`).

## Acceptance

- `buildKpopLibrary` optionally includes solo artists and songs (behind options/flags).
- Unit tests on fixtures (no network); a refresh against the test DB lands songs/solo artists.
- Docs/env updated; rate-limiting documented.
