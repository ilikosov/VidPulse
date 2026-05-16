import knex from '../../db';

function splitSongTitles(songTitle?: string, songTitles?: string[]): string[] {
  if (songTitles?.length) {
    return songTitles.map((song) => song.trim()).filter(Boolean);
  }

  if (!songTitle) return [];
  return songTitle
    .split(/\s*\+\s*/)
    .map((song) => song.trim())
    .filter(Boolean);
}

export async function syncVideoSongs(videoId: number, songTitle?: string, songTitles?: string[]) {
  const titles = splitSongTitles(songTitle, songTitles);
  if (titles.length === 0) return;

  for (const title of titles) {
    const existing = await knex('dictionary_songs')
      .select('id')
      .whereRaw('LOWER(title) = LOWER(?)', [title])
      .first();
    let songId = existing?.id as number | undefined;

    if (!songId) {
      const inserted = await knex('dictionary_songs').insert({ title }).returning('id');
      songId = Number(typeof inserted[0] === 'object' ? inserted[0].id : inserted[0]);
    }

    await knex('videos_songs')
      .insert({ video_id: videoId, song_id: songId })
      .onConflict(['video_id', 'song_id'])
      .ignore();
  }
}
