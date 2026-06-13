import { fetchJson } from '../http';
import type { GroupPayload, SourceOptions } from '../types';
import { buildGroupsQuery, WIKIDATA_SPARQL_ENDPOINT, type SparqlResults } from './queries';
import { normalizeGroups } from './normalize';

/**
 * Fetches K-pop groups and their members from the Wikidata SPARQL endpoint and
 * normalizes them into media-library GroupPayload[]. CC0 data; requires a
 * descriptive User-Agent (Wikidata blocks generic agents).
 */
export class WikidataSource {
  async fetchGroups(options: SourceOptions): Promise<GroupPayload[]> {
    const query = buildGroupsQuery(options.limit);
    const url = `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
    const data = await fetchJson<SparqlResults>(url, {
      userAgent: options.userAgent,
      fetchImpl: options.fetchImpl,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
    const bindings = data?.results?.bindings ?? [];
    return normalizeGroups(bindings);
  }
}

export const wikidataSource = new WikidataSource();
