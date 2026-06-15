import { fetchJson, sleep } from '../http';
import type { FetchLike, Logger } from '../types';

export const MUSICBRAINZ_ENDPOINT = 'https://musicbrainz.org/ws/2';

/** Page size for the recording browse endpoint (MusicBrainz max is 100). */
const PAGE_SIZE = 100;

/** A MusicBrainz recording (the subset we read). */
export interface MbRecording {
  id?: string;
  title?: string;
}

interface MbRecordingBrowse {
  recordings?: MbRecording[];
  'recording-count'?: number;
}

export interface FetchRecordingsOptions {
  userAgent: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Minimum ms between requests (≥1 req/s per MusicBrainz policy). Default 1000. */
  rateLimitMs?: number;
  /** Optional logger for partial-result diagnostics. */
  logger?: Logger;
}

/**
 * Browse all recordings (tracks) credited to a MusicBrainz artist, paginating the
 * `/recording?artist=<mbid>` endpoint until the reported `recording-count` is exhausted.
 * Throttles to ≤1 req/s (MusicBrainz ToS) by sleeping `rateLimitMs` between pages.
 *
 * Prolific artists span many pages; if a LATER page fails (after retries) we keep the
 * recordings gathered so far rather than discarding the whole artist. A failure on the
 * very first page still throws (the caller counts the group as failed).
 */
export async function fetchRecordingsByArtist(
  mbid: string,
  options: FetchRecordingsOptions,
): Promise<MbRecording[]> {
  const fetchOpts = {
    userAgent: options.userAgent,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    // MusicBrainz is aggressively rate-limited (HTTP 503); more retries with backoff
    // (1s/2s/4s/8s/16s) ride out bursts over a long enrichment run.
    retries: 5,
  };
  const rateLimitMs = options.rateLimitMs ?? 1000;

  const all: MbRecording[] = [];
  let offset = 0;
  for (;;) {
    const url =
      `${MUSICBRAINZ_ENDPOINT}/recording?artist=${encodeURIComponent(mbid)}` +
      `&fmt=json&limit=${PAGE_SIZE}&offset=${offset}`;

    let data: MbRecordingBrowse;
    try {
      data = await fetchJson<MbRecordingBrowse>(url, fetchOpts);
    } catch (err) {
      // Keep what we already have when a later page fails; only rethrow if nothing landed.
      if (all.length === 0) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      options.logger?.warn(
        `MusicBrainz: partial recordings for ${mbid} — kept ${all.length} (page at offset ${offset} failed: ${reason})`,
      );
      break;
    }

    const page = data.recordings ?? [];
    all.push(...page);

    const total = data['recording-count'] ?? all.length;
    offset += page.length;
    if (page.length === 0 || offset >= total) break;
    await sleep(rateLimitMs); // throttle between pages
  }
  return all;
}
