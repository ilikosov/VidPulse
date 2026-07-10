import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dictionary_aliases', (t) => {
    // Marks the alias to display instead of the entity's canonical name (see
    // docs/adr/0002-raw-parse-vs-canonical-display.md). The entity's own name/title column is
    // never overwritten — this only changes what's shown.
    t.boolean('is_primary').notNullable().defaultTo(false);
  });

  // At most one primary alias per entity. SQLite supports partial unique indexes; the service
  // layer still unsets the previous primary before setting a new one (two statements in a
  // transaction), since a single UPDATE could transiently violate this constraint otherwise.
  await knex.raw(`
    CREATE UNIQUE INDEX dictionary_aliases_one_primary_per_entity
    ON dictionary_aliases (entity_type, entity_id)
    WHERE is_primary = 1
  `);

  // Rebuild videos_display: the primary alias (if any) now wins over the dictionary's canonical
  // name, ahead of the raw parsed text. SQLite has no ALTER VIEW, so drop + recreate.
  await knex.raw('DROP VIEW IF EXISTS videos_display');
  await knex.raw(`
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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP VIEW IF EXISTS videos_display');
  await knex.raw(`
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
    LEFT JOIN dictionary_events  de ON de.id = v.event_id
  `);

  await knex.raw('DROP INDEX IF EXISTS dictionary_aliases_one_primary_per_entity');
  await knex.schema.alterTable('dictionary_aliases', (t) => {
    t.dropColumn('is_primary');
  });
}
