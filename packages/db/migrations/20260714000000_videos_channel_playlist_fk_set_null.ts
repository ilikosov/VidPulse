import type { Knex } from 'knex';

/**
 * The legacy `videos.channel_id` / `videos.playlist_id` FKs were declared ON DELETE CASCADE in the
 * baseline. But channel/playlist associations are actually held in the `video_channels` /
 * `video_playlists` junction tables, and the delete services intentionally keep videos unless
 * `removeVideos=true`. With `PRAGMA foreign_keys=ON`, deleting a channel/playlist cascaded and
 * silently deleted every video pointing at it — including videos the service meant to preserve.
 *
 * Switch these legacy FKs to ON DELETE SET NULL (matching how the video↔dictionary FKs already
 * behave), so deleting a channel/playlist only clears the denormalized column.
 *
 * On SQLite, changing a FK requires knex to rebuild the table (rename → recreate → copy). The
 * `videos_display` VIEW depends on `videos`, which blocks that rename, so we drop the view first
 * and recreate it verbatim afterwards (its current primary-alias form, unchanged by this migration).
 */

// The videos_display view as it currently stands (primary alias > canonical > raw). Recreated
// unchanged after the table rebuild.
const CREATE_VIDEOS_DISPLAY = `
  CREATE VIEW videos_display AS
  SELECT
    v.id, v.youtube_id, v.channel_id, v.playlist_id, v.original_title, v.url,
    v.published_at, v.status, v.duplicate_group_id, v.perf_date,
    COALESCE(pg.alias, dg.name, v.group_name)  AS group_name,
    COALESCE(pa.alias, da.name, v.artist_name) AS artist_name,
    COALESCE(pe.alias, de.name, v.event)       AS event,
    v.camera_type, v.file_path, v.preview_path, v.error_log,
    v.created_at, v.updated_at, v.duration_seconds, v.description,
    v.is_fancam, v.fancam_confidence,
    v.group_id, v.artist_id, v.event_id,
    v.is_own_group_song, v.is_own_artist_song, v.video_list_id,
    v.group_name  AS raw_group_name,
    v.artist_name AS raw_artist_name,
    v.event       AS raw_event
  FROM videos v
  LEFT JOIN dictionary_groups  dg ON dg.id = v.group_id
  LEFT JOIN dictionary_artists da ON da.id = v.artist_id
  LEFT JOIN dictionary_events  de ON de.id = v.event_id
  LEFT JOIN dictionary_aliases pg ON pg.entity_type = 'group'  AND pg.entity_id = v.group_id  AND pg.is_primary = 1
  LEFT JOIN dictionary_aliases pa ON pa.entity_type = 'artist' AND pa.entity_id = v.artist_id AND pa.is_primary = 1
  LEFT JOIN dictionary_aliases pe ON pe.entity_type = 'event'  AND pe.entity_id = v.event_id  AND pe.is_primary = 1
`;

async function changeVideoFks(knex: Knex, onDelete: 'SET NULL' | 'CASCADE'): Promise<void> {
  await knex.raw('DROP VIEW IF EXISTS videos_display');
  await knex.schema.alterTable('videos', (t) => {
    t.dropForeign(['channel_id']);
    t.dropForeign(['playlist_id']);
    t.integer('channel_id')
      .unsigned()
      .references('id')
      .inTable('channels')
      .onDelete(onDelete)
      .alter();
    t.integer('playlist_id')
      .unsigned()
      .references('id')
      .inTable('playlists')
      .onDelete(onDelete)
      .alter();
  });
  await knex.raw(CREATE_VIDEOS_DISPLAY);
}

export async function up(knex: Knex): Promise<void> {
  await changeVideoFks(knex, 'SET NULL');
}

export async function down(knex: Knex): Promise<void> {
  await changeVideoFks(knex, 'CASCADE');
}
