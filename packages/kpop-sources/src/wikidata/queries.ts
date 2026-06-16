export const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

// Wikidata entity ids referenced by the query.
export const QID = {
  KPOP_GENRE: 'wd:Q213665', // K-pop (genre)
  MUSICAL_ENSEMBLE: 'wd:Q2088357', // musical ensemble (group/band superclass)
  HUMAN: 'wd:Q5',
  GIRL_GROUP: 'wd:Q641066',
  BOY_BAND: 'wd:Q216337',
  SONG: 'wd:Q7366', // song (work)
  SINGLE: 'wd:Q134556', // single (release)
  MUSICAL_WORK: 'wd:Q105543609', // musical work/composition (many K-pop tracks use this, not "song")
} as const;

/** Group classifications → our group type. */
export const GROUP_TYPE_BY_QID: Record<string, 'female' | 'male'> = {
  Q641066: 'female', // girl group
  Q216337: 'male', // boy band
};

/**
 * Build the SPARQL query that returns one row per (group, member) for K-pop groups:
 * English + Korean labels, the girl-group/boy-band classification, dissolution date
 * (→ inactive), and each human member's labels plus their stage name (P742 pseudonym,
 * en/ko). Stage names are what video titles actually use (e.g. "Yeji", not the legal
 * "Hwang Ye-ji"), so normalize prefers them. A bounded sub-select keeps the group set
 * deterministic (ORDER BY) and cappable.
 *
 * Also fetches the group's MusicBrainz artist id (P434, `?mbid`) — a stable bridge to
 * MusicBrainz used by the opt-in song enrichment (full track-lists, which Wikidata lacks).
 */
export function buildGroupsQuery(limit?: number): string {
  const limitClause = limit && limit > 0 ? `LIMIT ${Math.floor(limit)}` : 'LIMIT 2000';
  return `
SELECT ?group ?groupEn ?groupKo ?typeClass ?dissolved ?mbid ?member ?memberEn ?memberKo ?memberStageEn ?memberStageKo WHERE {
  {
    SELECT DISTINCT ?group WHERE {
      ?group wdt:P136 ${QID.KPOP_GENRE} .
      ?group wdt:P31/wdt:P279* ${QID.MUSICAL_ENSEMBLE} .
    } ORDER BY ?group ${limitClause}
  }
  OPTIONAL { ?group rdfs:label ?groupEn FILTER(LANG(?groupEn) = "en") }
  OPTIONAL { ?group rdfs:label ?groupKo FILTER(LANG(?groupKo) = "ko") }
  OPTIONAL { ?group wdt:P434 ?mbid }
  OPTIONAL { ?group wdt:P31 ?typeClass FILTER(?typeClass IN (${QID.GIRL_GROUP}, ${QID.BOY_BAND})) }
  OPTIONAL { ?group wdt:P576 ?dissolved }
  OPTIONAL {
    ?group wdt:P527 ?member .
    ?member wdt:P31 ${QID.HUMAN} .
    OPTIONAL { ?member rdfs:label ?memberEn FILTER(LANG(?memberEn) = "en") }
    OPTIONAL { ?member rdfs:label ?memberKo FILTER(LANG(?memberKo) = "ko") }
    OPTIONAL { ?member wdt:P742 ?memberStageEn FILTER(LANG(?memberStageEn) = "en") }
    OPTIONAL { ?member wdt:P742 ?memberStageKo FILTER(LANG(?memberStageKo) = "ko") }
  }
}`.trim();
}

/**
 * Build the SPARQL query that returns one row per (group, song) for the same bounded
 * K-pop group set as `buildGroupsQuery`: each song's English + Korean labels. Songs are
 * fetched in a SEPARATE query (not merged into the groups query) to avoid a cartesian
 * blow-up of members × songs per group. A song is linked to its performer via P175.
 *
 * Type filter uses a DIRECT `wdt:P31` against {song, single, musical work/composition}.
 * Direct (not `P31/P279*`) matters: many K-pop tracks are typed as Q105543609
 * (musical work/composition), which is NOT a subclass of "song" so a closure from
 * Q7366 missed them; and a closure from Q105543609 would wrongly pull in releases
 * (albums/EPs are subclasses of "musical work"). Releases (album/EP/mini-album) and
 * tours are intentionally excluded — they aren't individual songs. Normalize folds the
 * results into each group's `songs[]` by group URI.
 */
export function buildSongsQuery(limit?: number): string {
  const limitClause = limit && limit > 0 ? `LIMIT ${Math.floor(limit)}` : 'LIMIT 2000';
  return `
SELECT ?group ?song ?songEn ?songKo WHERE {
  {
    SELECT DISTINCT ?group WHERE {
      ?group wdt:P136 ${QID.KPOP_GENRE} .
      ?group wdt:P31/wdt:P279* ${QID.MUSICAL_ENSEMBLE} .
    } ORDER BY ?group ${limitClause}
  }
  ?song wdt:P175 ?group .
  ?song wdt:P31 ?songType .
  VALUES ?songType { ${QID.SONG} ${QID.SINGLE} ${QID.MUSICAL_WORK} }
  OPTIONAL { ?song rdfs:label ?songEn FILTER(LANG(?songEn) = "en") }
  OPTIONAL { ?song rdfs:label ?songKo FILTER(LANG(?songKo) = "ko") }
}`.trim();
}

/** Shape of a SPARQL JSON results document (the subset we read). */
export interface SparqlBinding {
  [key: string]: { type: string; value: string; 'xml:lang'?: string } | undefined;
}
export interface SparqlResults {
  results: { bindings: SparqlBinding[] };
}
