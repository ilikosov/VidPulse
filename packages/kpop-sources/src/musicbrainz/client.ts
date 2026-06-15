import { fetchJson, sleep } from '../http';
import type { FetchLike } from '../types';

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
}

/**
 * Browse all recordings (tracks) credited to a MusicBrainz artist, paginating the
 * `/recording?artist=<mbid>` endpoint until the reported `recording-count` is exhausted.
 * Throttles to ≤1 req/s (MusicBrainz ToS) by sleeping `rateLimitMs` between pages.
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
    const data = await fetchJson<MbRecordingBrowse>(url, fetchOpts);
    const page = data.recordings ?? [];
    all.push(...page);

    const total = data['recording-count'] ?? all.length;
    offset += page.length;
    if (page.length === 0 || offset >= total) break;
    await sleep(rateLimitMs); // throttle between pages
  }
  return all;
}
