import type { Knex } from 'knex';

/**
 * TASK-3 / ADR 0002: drop the legacy single-value song columns from `videos`.
 *
 * Songs are now fully owned by the `video_songs` junction table (TASK-2). The
 * `group/artist/event` raw columns stay — they are the evidence behind the
 * `videos_display` view (TASK-1); only `song_id` / `song_title` are removed.
 *
 * The view and the song-referencing indexes are dropped first, the columns are
 * removed, then the index/view are recreated without the song columns.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP VIEW IF EXISTS videos_display;');
  await knex.schema.raw('DROP INDEX IF EXISTS videos_song_id_idx;');
  await knex.schema.raw('DROP INDEX IF EXISTS videos_perf_meta_idx;');

  await knex.schema.alterTable('videos', (t) => {
    t.dropColumn('song_id');
    t.dropColumn('song_title');
  });

  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS videos_perf_meta_idx ON videos (perf_date, group_name, artist_name, event);',
  );

  await knex.schema.raw(`
    CREATE VIEW videos_display AS
    SELECT
      v.id, v.youtube_id, v.channel_id, v.playlist_id, v.original_title, v.url,
      v.published_at, v.status, v.duplicate_group_id, v.perf_date,
      COALESCE(dg.name,  v.group_name)  AS group_name,
      COALESCE(da.name,  v.artist_name) AS artist_name,
      COALESCE(de.name,  v.event)       AS event,
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
    LEFT JOIN dictionary_events  de ON de.id = v.event_id;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP VIEW IF EXISTS videos_display;');
  await knex.schema.raw('DROP INDEX IF EXISTS videos_perf_meta_idx;');

  await knex.schema.alterTable('videos', (t) => {
    t.integer('song_id');
    t.string('song_title');
  });

  // Best-effort restore from the junction table's first song.
  await knex.raw(`
    UPDATE videos SET
      song_id = (
        SELECT vs.song_id FROM video_songs vs
        WHERE vs.video_id = videos.id ORDER BY vs.position LIMIT 1
      ),
      song_title = (
        SELECT COALESCE(ds.title, vs.raw_title) FROM video_songs vs
        LEFT JOIN dictionary_songs ds ON ds.id = vs.song_id
        WHERE vs.video_id = videos.id ORDER BY vs.position LIMIT 1
      );
  `);

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS videos_song_id_idx ON videos (song_id);');
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS videos_perf_meta_idx ON videos (perf_date, group_name, artist_name, song_title, event);',
  );

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
