import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS video_playlists (
      video_id    INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, playlist_id)
    )
  `);
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS video_playlists_playlist_id_idx ON video_playlists(playlist_id)',
  );

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS video_channels (
      video_id   INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      PRIMARY KEY (video_id, channel_id)
    )
  `);
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS video_channels_channel_id_idx ON video_channels(channel_id)',
  );

  // Backfill from existing FK columns
  await knex.raw(`
    INSERT OR IGNORE INTO video_playlists (video_id, playlist_id)
    SELECT id, playlist_id FROM videos WHERE playlist_id IS NOT NULL
  `);
  await knex.raw(`
    INSERT OR IGNORE INTO video_channels (video_id, channel_id)
    SELECT id, channel_id FROM videos WHERE channel_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS video_playlists_playlist_id_idx');
  await knex.raw('DROP INDEX IF EXISTS video_channels_channel_id_idx');
  await knex.schema.dropTableIfExists('video_playlists');
  await knex.schema.dropTableIfExists('video_channels');
}
