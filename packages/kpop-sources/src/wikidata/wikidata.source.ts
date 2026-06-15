import { fetchJson } from '../http';
import type { EnrichableGroup, SourceOptions } from '../types';
import {
  buildGroupsQuery,
  buildSongsQuery,
  WIKIDATA_SPARQL_ENDPOINT,
  type SparqlResults,
} from './queries';
import { normalizeGroups, normalizeSongs } from './normalize';

/**
 * Fetches K-pop groups and their members from the Wikidata SPARQL endpoint and
 * normalizes them into media-library GroupPayload[]. CC0 data; requires a
 * descriptive User-Agent (Wikidata blocks generic agents).
 */
export class WikidataSource {
  async fetchGroups(options: SourceOptions): Promise<EnrichableGroup[]> {
    const log = options.logger;
    const fetchOpts = {
      userAgent: options.userAgent,
      fetchImpl: options.fetchImpl,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    };
    const queryUrl = (query: string) =>
      `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;

    log?.info(
      `Wikidata: fetching K-pop groups+members and songs (limit=${options.limit ?? 'default'})`,
    );
    const startedAt = Date.now();

    // Groups+members and songs are separate queries to avoid a members × songs blow-up.
    let groupsData: SparqlResults;
    let songsData: SparqlResults;
    try {
      [groupsData, songsData] = await Promise.all([
        fetchJson<SparqlResults>(queryUrl(buildGroupsQuery(options.limit)), fetchOpts),
        fetchJson<SparqlResults>(queryUrl(buildSongsQuery(options.limit)), fetchOpts),
      ]);
    } catch (err) {
      log?.error('Wikidata: SPARQL request failed:', err);
      throw err;
    }

    const groupRows = groupsData?.results?.bindings ?? [];
    const songRows = songsData?.results?.bindings ?? [];
    log?.debug?.(
      `Wikidata: received ${groupRows.length} group row(s), ${songRows.length} song row(s)`,
    );

    const songsByGroup = normalizeSongs(songRows);
    const groups = normalizeGroups(groupRows, songsByGroup);

    const memberCount = groups.reduce((n, g) => n + (g.artists?.length ?? 0), 0);
    const songCount = groups.reduce((n, g) => n + (g.songs?.length ?? 0), 0);
    log?.info(
      `Wikidata: normalized ${groups.length} group(s), ${memberCount} member(s), ${songCount} song(s) in ${Date.now() - startedAt}ms`,
    );

    return groups;
  }
}

export const wikidataSource = new WikidataSource();
