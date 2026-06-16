import type { SongPayload } from '../types';
import type { MbRecording } from './client';

/**
 * Fold MusicBrainz recordings into deduplicated SongPayload[]. MusicBrainz lists every
 * version of a track (per release, live, instrumental, remix…), so we dedupe
 * case-insensitively by title and keep the first-seen spelling. Recordings without a
 * usable title are skipped. (Smarter variant filtering — dropping "(Live)"/"(Inst.)" —
 * is left for a follow-up; collapsing by exact title already removes the bulk of noise.)
 */
export function normalizeRecordings(recordings: MbRecording[]): SongPayload[] {
  const songs: SongPayload[] = [];
  const seen = new Set<string>();

  for (const rec of recordings) {
    const title = rec.title?.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    songs.push({ title, aliases: [] });
  }

  return songs;
}
