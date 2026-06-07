import type { Knex } from 'knex';

/**
 * TASK-1 / ADR 0002: the display value for group/artist/event (and the legacy
 * single song) is derived on read as COALESCE(dictionary canonical, raw parse),
 * instead of being stored. Reads select from this view; writes still target the
 * `videos` base table (its text columns hold the raw parse = evidence).
 *
 * The view re-exposes group_name/artist_name/song_title/event as the *display*
 * value, and also surfaces the underlying raw parse as raw_* columns.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    CREATE VIEW videos_display AS
    SELECT
      v.id, v.youtube_id, v.channel_id, v.playlist_id, v.original_title, v.url,
      v.published_at, v.status, v.duplicate_group_id, v.perf_date,
      COALESCE(dg.name,  v.group_name)  AS group_name,
      COALESCE(da.name,  v.artist_name) AS artist_name,
      COALESCE(ds.title, v.song_title)  AS song_title,
      COALESCE(de.name,  v.event)       AS event,
      v.camera_type, v.file_path, v.preview_path, v.error_log,
      v.created_at, v.updated_at, v.duration_seconds, v.description,
      v.is_fancam, v.fancam_confidence,
      v.group_id, v.artist_id, v.song_id, v.event_id,
      v.is_own_group_song, v.is_own_artist_song, v.video_list_id,
      v.group_name  AS raw_group_name,
      v.artist_name AS raw_artist_name,
      v.song_title  AS raw_song_title,
      v.event       AS raw_event
    FROM videos v
    LEFT JOIN dictionary_groups  dg ON dg.id = v.group_id
    LEFT JOIN dictionary_artists da ON da.id = v.artist_id
    LEFT JOIN dictionary_songs   ds ON ds.id = v.song_id
    LEFT JOIN dictionary_events  de ON de.id = v.event_id;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP VIEW IF EXISTS videos_display;');
}
