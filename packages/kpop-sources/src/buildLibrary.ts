import type { MediaLibrarySnapshot, SourceOptions } from './types';
import { wikidataSource } from './wikidata/wikidata.source';

/**
 * Build a complete media-library snapshot from external K-pop sources.
 *
 * Phase 1 sources Wikidata only (groups + members + aliases + type + active).
 * Solo artists, songs, and events are left empty here — events stay seeded
 * manually; songs are a future source (MusicBrainz). The result is a `merge`
 * snapshot ready for `MediaLibraryService.importMediaLibrary`.
 */
export async function buildKpopLibrary(options: SourceOptions): Promise<MediaLibrarySnapshot> {
  const groups = await wikidataSource.fetchGroups(options);
  return {
    version: 1,
    mode: 'merge',
    exportedAt: new Date().toISOString(),
    groups,
    soloArtists: [],
    events: [],
  };
}
