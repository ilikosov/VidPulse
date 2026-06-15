import { sleep } from '../http';
import type { EnrichableGroup, SongPayload, SourceOptions } from '../types';
import { fetchRecordingsByArtist } from './client';
import { normalizeRecordings } from './normalize';

/**
 * Merge MusicBrainz recording titles into a group's existing songs, deduping
 * case-insensitively against titles already present (from Wikidata).
 */
function mergeSongs(group: EnrichableGroup, incoming: SongPayload[]): number {
  const existing = (group.songs ??= []);
  const seen = new Set(existing.map((s) => s.title.toLowerCase()));
  let added = 0;
  for (const song of incoming) {
    const key = song.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    existing.push(song);
    added += 1;
  }
  return added;
}

/**
 * Enriches groups with full track-lists from MusicBrainz. Wikidata only models title
 * tracks/singles as standalone items, so album tracks and B-sides (e.g. ITZY's
 * "Untouchable") are missing; MusicBrainz has the complete recording list. Each group is
 * bridged to a MusicBrainz artist via its Wikidata P434 id (`group.mbid`); groups without
 * one are skipped. Requests are throttled to ≤1 req/s (MusicBrainz ToS).
 */
export class MusicBrainzSource {
  async enrich(groups: EnrichableGroup[], options: SourceOptions): Promise<void> {
    const mb = options.musicBrainz;
    if (!mb?.enabled) return;
    const log = options.logger;

    const userAgent = mb.userAgent ?? options.userAgent;
    const rateLimitMs = mb.rateLimitMs ?? 1000;
    const candidates = groups.filter((g) => g.mbid);
    const targets = mb.limit && mb.limit > 0 ? candidates.slice(0, mb.limit) : candidates;

    log?.info(
      `MusicBrainz: enriching ${targets.length}/${groups.length} group(s) with track-lists ` +
        `(rate=${rateLimitMs}ms)`,
    );
    const startedAt = Date.now();
    let addedTotal = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += 1) {
      const group = targets[i];
      try {
        const recordings = await fetchRecordingsByArtist(group.mbid!, {
          userAgent,
          fetchImpl: options.fetchImpl,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          rateLimitMs,
          logger: log,
        });
        addedTotal += mergeSongs(group, normalizeRecordings(recordings));
      } catch (err) {
        // One group's failure shouldn't abort the whole enrichment. Log the message
        // (not the Error object — the server logger JSON.stringifies it to "{}").
        failed += 1;
        const reason = err instanceof Error ? err.message : String(err);
        log?.warn(`MusicBrainz: failed to enrich "${group.name}" (${group.mbid}): ${reason}`);
      }
      // Throttle between groups (skip after the last one).
      if (i < targets.length - 1) await sleep(rateLimitMs);
    }

    log?.info(
      `MusicBrainz: added ${addedTotal} song(s) across ${targets.length - failed} group(s), ` +
        `${failed} failed in ${Date.now() - startedAt}ms`,
    );
  }
}

export const musicBrainzSource = new MusicBrainzSource();
