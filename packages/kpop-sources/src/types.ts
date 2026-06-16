/**
 * Shapes mirroring the VidPulse media-library import payload
 * (`apps/server/schemas/media-library.schema.json`). The server validates the
 * snapshot against that schema before importing, so these types must stay in sync
 * with it. We only model the subset the K-pop sources produce.
 */

export type GroupType = 'male' | 'female' | 'mixed';

export interface MembershipPayload {
  activityType: 'group' | 'solo';
  status: 'active' | 'former' | 'hiatus';
  /** ISO date (YYYY-MM-DD) or null. */
  from?: string | null;
  to?: string | null;
  isPrimary?: boolean;
}

export interface SongPayload {
  title: string;
  aliases: string[];
}

export interface GroupArtistPayload {
  name: string;
  aliases?: string[];
  membership?: MembershipPayload;
  songs?: SongPayload[];
}

export interface GroupPayload {
  name: string;
  type?: GroupType;
  active?: boolean;
  aliases?: string[];
  artists?: GroupArtistPayload[];
  songs?: SongPayload[];
}

/**
 * A GroupPayload carrying its MusicBrainz artist id (Wikidata P434) for the song
 * enrichment step. `mbid` is a RUNTIME-only field — the media-library schema forbids
 * extra group properties, so `buildKpopLibrary` strips it before producing the snapshot.
 */
export type EnrichableGroup = GroupPayload & { mbid?: string };

export interface SoloArtistPayload {
  name: string;
  aliases?: string[];
  membership?: MembershipPayload;
  songs?: SongPayload[];
}

export interface EventPayload {
  name: string;
  aliases?: string[];
}

/** A complete media-library snapshot, accepted by `importMediaLibrary`. */
export interface MediaLibrarySnapshot {
  version: 1;
  mode: 'merge' | 'replace';
  exportedAt?: string;
  groups: GroupPayload[];
  soloArtists: SoloArtistPayload[];
  events: EventPayload[];
}

/** Minimal cross-platform fetch signature so callers/tests can inject an impl. */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

/**
 * Minimal logger sink (compatible with the server's `logger`). `debug` is optional;
 * when no logger is supplied the source stays silent.
 */
export interface Logger {
  debug?(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Opt-in MusicBrainz enrichment: after Wikidata builds the groups, fetch each group's
 * full recording list (by its Wikidata P434 MusicBrainz id) and merge those titles into
 * `groups[].songs`. Wikidata only has title tracks/singles as standalone items, so this
 * is how album tracks and B-sides reach the dictionary. MusicBrainz requires a
 * descriptive User-Agent and caps requests at ~1/sec.
 */
export interface MusicBrainzOptions {
  enabled: boolean;
  /** Descriptive User-Agent — required by MusicBrainz ToS. Falls back to SourceOptions.userAgent. */
  userAgent?: string;
  /** Minimum ms between MusicBrainz requests (default 1000 → ≤1 req/s). */
  rateLimitMs?: number;
  /**
   * Chunk size: how many candidate groups (those with an mbid) to enrich in this run.
   * `0`/unset enriches all of them at once. Combine with `priority` to process the catalogue
   * "по частям" across several refreshes, bounding the connection load per run.
   */
  limit?: number;
  /**
   * Ordering key for candidate groups — lower sorts earlier. The server keys this on each group's
   * stored `songs_enriched_at` (never-enriched = 0 → first), so each chunk picks the stalest groups
   * and connect-timeout stragglers (left un-stamped) come back to the front next run. Unset keeps
   * the source order.
   */
  priority?: (group: EnrichableGroup) => number;
  /** Stop paginating an artist after this many recordings (bounds requests for prolific artists). */
  maxRecordings?: number;
  /**
   * Reports which groups were successfully enriched this run (by `group.name`) so the caller can
   * stamp their `songs_enriched_at`. Failed groups are omitted, keeping them stale for next run.
   */
  onProgress?: (info: { total: number; processed: string[] }) => void;
}

export interface SourceOptions {
  /** Descriptive User-Agent — required by Wikidata's access policy. */
  userAgent: string;
  /** Cap the number of groups fetched (useful for smoke runs/tests). */
  limit?: number;
  /** Injectable fetch (defaults to global fetch). Tests pass a stub. */
  fetchImpl?: FetchLike;
  /** Abort signal to cancel in-flight requests. */
  signal?: AbortSignal;
  /** Per-request timeout in ms (default 30s). */
  timeoutMs?: number;
  /** Optional logger for progress/diagnostics (defaults to silent). */
  logger?: Logger;
  /** Opt-in MusicBrainz song enrichment (off unless `enabled`). */
  musicBrainz?: MusicBrainzOptions;
}
