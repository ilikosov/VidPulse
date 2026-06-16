import type { GroupPayload, MediaLibrarySnapshot, SourceOptions } from './types';
import { wikidataSource } from './wikidata/wikidata.source';
import { musicBrainzSource } from './musicbrainz/musicbrainz.source';

/**
 * Build a complete media-library snapshot from external K-pop sources.
 *
 * Wikidata provides groups + members + aliases + type + active, plus each group's title
 * tracks/singles (P175 performer) carried in `groups[].songs`. When MusicBrainz enrichment
 * is enabled (`options.musicBrainz.enabled`), each group's full recording list is fetched
 * from MusicBrainz (bridged via the group's Wikidata P434 id) and merged into its songs —
 * this is how album tracks and B-sides, which Wikidata lacks, reach the dictionary.
 *
 * Solo artists and events are left empty here. The result is a `merge` snapshot ready for
 * `MediaLibraryService.importMediaLibrary`.
 */
export async function buildKpopLibrary(options: SourceOptions): Promise<MediaLibrarySnapshot> {
  const enriched = await wikidataSource.fetchGroups(options);
  await musicBrainzSource.enrich(enriched, options);

  // `mbid` is a runtime-only bridge field; the media-library schema forbids extra group
  // properties, so strip it before producing the snapshot.
  const groups: GroupPayload[] = enriched.map(({ mbid: _mbid, ...group }) => group);

  return {
    version: 1,
    mode: 'merge',
    exportedAt: new Date().toISOString(),
    groups,
    soloArtists: [],
    events: [],
  };
}
