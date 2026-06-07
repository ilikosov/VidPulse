import type { Knex } from 'knex';
import knex from '../../db';
import { dedupeTitlesCaseInsensitive, splitSongTitles } from './songTitles.util';

/**
 * Resolve a raw song title to a canonical `dictionary_songs.id`, matching by
 * title or alias. Unlike the old behaviour, this does **not** create dictionary
 * entries — the dictionary is curated; unmatched titles keep `song_id = null`
 * and are displayed from their raw title (TASK-2 / ADR 0002).
 */
async function resolveSongId(db: Knex, title: string): Promise<number | null> {
  const byTitle = await db('dictionary_songs')
    .whereRaw('LOWER(title) = LOWER(?)', [title])
    .first('id');
  if (byTitle) return Number(byTitle.id);

  const byAlias = await db('dictionary_aliases')
    .where({ entity_type: 'song' })
    .whereRaw('LOWER(alias) = LOWER(?)', [title])
    .first('entity_id');
  return byAlias ? Number(byAlias.entity_id) : null;
}

/**
 * Replace the full, ordered set of songs for a video in the `video_songs`
 * junction table (the single source of truth for a video's songs).
 *
 * Each row stores the raw parsed title (evidence) and its `position`; `song_id`
 * links to the canonical dictionary song when one matches, otherwise stays null.
 * Pass `db` to run inside an existing transaction.
 */
export async function syncVideoSongs(
  videoId: number,
  songTitle?: string,
  songTitles?: string[],
  db: Knex = knex,
) {
  const titles = dedupeTitlesCaseInsensitive(splitSongTitles(songTitle, songTitles));

  // Full-replace: positions are reassigned from scratch.
  await db('video_songs').where('video_id', videoId).del();

  let position = 0;
  for (const rawTitle of titles) {
    const songId = await resolveSongId(db, rawTitle);
    await db('video_songs').insert({
      video_id: videoId,
      position,
      raw_title: rawTitle,
      song_id: songId,
    });
    position += 1;
  }
}

/**
 * Fetch the songs linked to each of the given videos, keyed by video id, in
 * `position` order. Each song's display title is COALESCE(dictionary, raw), so
 * songs without a dictionary match are still returned (with `id: null`).
 */
export async function getVideoSongsMap(
  videoIds: number[],
  db: Knex = knex,
): Promise<Map<number, Array<{ id: number | null; title: string }>>> {
  const songsByVideo = new Map<number, Array<{ id: number | null; title: string }>>();
  if (videoIds.length === 0) return songsByVideo;

  const rows = await db('video_songs as vs')
    .leftJoin('dictionary_songs as ds', 'vs.song_id', 'ds.id')
    .select(
      'vs.video_id',
      'vs.song_id',
      'vs.raw_title',
      'vs.position',
      'ds.title as canonical_title',
    )
    .whereIn('vs.video_id', videoIds)
    .orderBy(['vs.video_id', 'vs.position']);

  for (const row of rows) {
    const songs = songsByVideo.get(row.video_id) ?? [];
    songs.push({
      id: row.song_id ?? null,
      title: row.canonical_title ?? row.raw_title,
    });
    songsByVideo.set(row.video_id, songs);
  }
  return songsByVideo;
}
