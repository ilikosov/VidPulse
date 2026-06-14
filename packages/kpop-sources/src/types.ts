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
}
