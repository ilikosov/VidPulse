import { fetchJson } from '../http';
import type { GroupPayload, SourceOptions } from '../types';
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
  async fetchGroups(options: SourceOptions): Promise<GroupPayload[]> {
    const fetchOpts = {
      userAgent: options.userAgent,
      fetchImpl: options.fetchImpl,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    };
    const queryUrl = (query: string) =>
      `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;

    // Groups+members and songs are separate queries to avoid a members × songs blow-up.
    const [groupsData, songsData] = await Promise.all([
      fetchJson<SparqlResults>(queryUrl(buildGroupsQuery(options.limit)), fetchOpts),
      fetchJson<SparqlResults>(queryUrl(buildSongsQuery(options.limit)), fetchOpts),
    ]);

    const songsByGroup = normalizeSongs(songsData?.results?.bindings ?? []);
    return normalizeGroups(groupsData?.results?.bindings ?? [], songsByGroup);
  }
}

export const wikidataSource = new WikidataSource();
