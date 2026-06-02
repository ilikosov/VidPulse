import type { Knex } from 'knex';
import knex from '../../db';
import { dedupeTitlesCaseInsensitive, splitSongTitles } from './songTitles.util';

/**
 * Replace the full set of songs linked to a video in the `video_songs`
 * junction table (the single source of truth for a video's songs).
 *
 * Songs missing from the new set are unlinked; new songs are created in
 * `dictionary_songs` when they don't exist yet. Pass `db` to run inside an
 * existing transaction.
 */
export async function syncVideoSongs(
  videoId: number,
  songTitle?: string,
  songTitles?: string[],
  db: Knex = knex,
) {
  const titles = dedupeTitlesCaseInsensitive(splitSongTitles(songTitle, songTitles));

  const targetSongIds: number[] = [];
  for (const title of titles) {
    const existing = await db('dictionary_songs')
      .select('id')
      .whereRaw('LOWER(title) = LOWER(?)', [title])
      .first();
    let songId = existing?.id as number | undefined;

    if (!songId) {
      const inserted = await db('dictionary_songs').insert({ title }).returning('id');
      songId = Number(typeof inserted[0] === 'object' ? inserted[0].id : inserted[0]);
    }

    targetSongIds.push(Number(songId));
  }

  // Unlink songs that are no longer part of the set (full-replace semantics).
  const removeQuery = db('video_songs').where('video_id', videoId);
  if (targetSongIds.length > 0) {
    removeQuery.whereNotIn('song_id', targetSongIds);
  }
  await removeQuery.del();

  for (const songId of targetSongIds) {
    await db('video_songs')
      .insert({ video_id: videoId, song_id: songId })
      .onConflict(['video_id', 'song_id'])
      .ignore();
  }
}

/**
 * Fetch the songs linked to each of the given videos, keyed by video id.
 * Mirrors the `getVideoTagsMap` pattern used for tags. Titles are ordered
 * alphabetically (the junction table has no explicit ordering column).
 */
export async function getVideoSongsMap(
  videoIds: number[],
  db: Knex = knex,
): Promise<Map<number, Array<{ id: number; title: string }>>> {
  const songsByVideo = new Map<number, Array<{ id: number; title: string }>>();
  if (videoIds.length === 0) return songsByVideo;

  const rows = await db('video_songs')
    .join('dictionary_songs', 'video_songs.song_id', 'dictionary_songs.id')
    .select('video_songs.video_id', 'dictionary_songs.id', 'dictionary_songs.title')
    .whereIn('video_songs.video_id', videoIds)
    .orderBy('dictionary_songs.title', 'asc');

  for (const row of rows) {
    const songs = songsByVideo.get(row.video_id) ?? [];
    songs.push({ id: row.id, title: row.title });
    songsByVideo.set(row.video_id, songs);
  }
  return songsByVideo;
}
