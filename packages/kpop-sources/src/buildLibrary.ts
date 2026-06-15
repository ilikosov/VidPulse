import type { MediaLibrarySnapshot, SourceOptions } from './types';
import { wikidataSource } from './wikidata/wikidata.source';

/**
 * Build a complete media-library snapshot from external K-pop sources.
 *
 * Sources Wikidata only: groups + members + aliases + type + active, plus each
 * group's songs (P175 performer → song/single) carried in `groups[].songs`. Solo
 * artists and events are left empty here — events stay seeded manually; solo-artist
 * songs are a future source. The result is a `merge` snapshot ready for
 * `MediaLibraryService.importMediaLibrary`.
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
