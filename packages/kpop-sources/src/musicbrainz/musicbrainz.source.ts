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
    // After a network failure, wait longer before the next group so a flaky/slow
    // connection (e.g. UND_ERR_CONNECT_TIMEOUT through the egress proxy) can recover.
    const cooldownMs = Math.max(rateLimitMs * 3, 3000);
    const candidates = groups.filter((g) => g.mbid);
    const total = candidates.length;
    // Enrich the stalest groups first (oldest/never `songs_enriched_at` via `priority`) and only a
    // chunk per run, so the catalogue fills in "по частям" across refreshes — bounding the
    // connection load per run and letting connect-timeout stragglers come back first next run.
    const ordered = mb.priority
      ? [...candidates].sort((a, b) => mb.priority!(a) - mb.priority!(b))
      : candidates;
    const limit = mb.limit && mb.limit > 0 ? mb.limit : total;
    const targets = ordered.slice(0, limit);

    log?.info(
      `MusicBrainz: enriching ${targets.length} of ${total} group(s) (oldest first) ` +
        `with track-lists (rate=${rateLimitMs}ms)`,
    );
    const startedAt = Date.now();
    const processed: string[] = [];
    let addedTotal = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += 1) {
      const group = targets[i];
      let failedThisGroup = false;
      try {
        const recordings = await fetchRecordingsByArtist(group.mbid!, {
          userAgent,
          fetchImpl: options.fetchImpl,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          rateLimitMs,
          maxRecordings: mb.maxRecordings,
          logger: log,
        });
        addedTotal += mergeSongs(group, normalizeRecordings(recordings));
        // Only successful groups are reported; failures stay un-stamped (stale) for next run.
        processed.push(group.name);
      } catch (err) {
        // One group's failure shouldn't abort the whole enrichment. Log the message
        // (not the Error object — the server logger JSON.stringifies it to "{}").
        failed += 1;
        failedThisGroup = true;
        const reason = err instanceof Error ? err.message : String(err);
        log?.warn(`MusicBrainz: failed to enrich "${group.name}" (${group.mbid}): ${reason}`);
      }
      // Throttle between groups (skip after the last one); back off longer after a failure.
      if (i < targets.length - 1) await sleep(failedThisGroup ? cooldownMs : rateLimitMs);
    }

    log?.info(
      `MusicBrainz: added ${addedTotal} song(s) across ${targets.length - failed} group(s), ` +
        `${failed} failed in ${Date.now() - startedAt}ms`,
    );

    // Report which groups succeeded so the caller can stamp their `songs_enriched_at`.
    mb.onProgress?.({ total, processed });
  }
}

export const musicBrainzSource = new MusicBrainzSource();
