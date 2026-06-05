import type { Knex } from 'knex';

type AliasRow = { entity_id: number; alias: string };
type ArtistRow = { id: number; name: string; group_id: number | null };
type SongRow = { id: number; artist: string | null };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dictionary_song_artists', (t) => {
    t.integer('song_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_songs')
      .onDelete('CASCADE');
    t.integer('artist_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_artists')
      .onDelete('CASCADE');
    t.primary(['song_id', 'artist_id']);
  });

  await knex.schema.createTable('dictionary_song_groups', (t) => {
    t.integer('song_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_songs')
      .onDelete('CASCADE');
    t.integer('group_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_groups')
      .onDelete('CASCADE');
    t.primary(['song_id', 'group_id']);
  });

  const songs = (await knex('dictionary_songs').select('id', 'artist')) as SongRow[];
  const artists = (await knex('dictionary_artists').select(
    'id',
    'name',
    'group_id',
  )) as ArtistRow[];
  const aliases = (await knex('dictionary_aliases')
    .select('entity_id', 'alias')
    .where({ entity_type: 'artist' })) as AliasRow[];

  const artistByName = new Map<string, ArtistRow>();
  artists.forEach((artist) => artistByName.set(artist.name.trim().toLowerCase(), artist));
  aliases.forEach((alias) => {
    const canonical = artists.find((artist) => artist.id === alias.entity_id);
    if (canonical) artistByName.set(alias.alias.trim().toLowerCase(), canonical);
  });

  const unmatched: number[] = [];

  for (const song of songs) {
    const key = (song.artist || '').trim().toLowerCase();
    if (!key) continue;
    const artist = artistByName.get(key);
    if (!artist) {
      unmatched.push(song.id);
      continue;
    }

    await knex('dictionary_song_artists')
      .insert({ song_id: song.id, artist_id: artist.id })
      .onConflict(['song_id', 'artist_id'])
      .ignore();

    if (artist.group_id) {
      await knex('dictionary_song_groups')
        .insert({ song_id: song.id, group_id: artist.group_id })
        .onConflict(['song_id', 'group_id'])
        .ignore();
    }
  }

  if (unmatched.length) {
    console.warn(`[migration] dictionary song links unmatched artist rows: ${unmatched.length}`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dictionary_song_groups');
  await knex.schema.dropTableIfExists('dictionary_song_artists');
}
