import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('PRAGMA foreign_keys = ON;');

  // ── Core ──────────────────────────────────────────────────────────────────

  await knex.schema.createTable('channels', (t) => {
    t.increments('id').primary();
    t.text('youtube_id').notNullable().unique();
    t.text('title').notNullable();
    t.text('thumbnail_url');
    t.boolean('is_favorite').defaultTo(false);
    t.timestamp('added_at').defaultTo(knex.fn.now());
    t.timestamp('last_checked_at');
  });

  await knex.schema.createTable('playlists', (t) => {
    t.increments('id').primary();
    t.text('youtube_id').notNullable().unique();
    t.text('title').notNullable();
    t.timestamp('added_at').defaultTo(knex.fn.now());
    t.timestamp('last_checked_at');
  });

  // duplicate_groups.primary_video_id references videos, but SQLite cannot add
  // a FK via ALTER TABLE, so that FK has never been enforced — omit it here.
  await knex.schema.createTable('duplicate_groups', (t) => {
    t.increments('id').primary();
    t.integer('primary_video_id').unsigned();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('video_lists', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable();
    t.text('color').notNullable().unique();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // ── Dictionary ────────────────────────────────────────────────────────────

  await knex.schema.createTable('dictionary_groups', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable().unique();
    t.text('type').notNullable();
    t.boolean('active').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('dictionary_artists', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable();
    t.integer('group_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_groups')
      .onDelete('CASCADE');
    t.unique(['name', 'group_id']);
  });

  await knex.schema.createTable('dictionary_songs', (t) => {
    t.increments('id').primary();
    t.text('title').notNullable();
    t.text('artist');
  });

  await knex.schema.createTable('dictionary_events', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable().unique();
  });

  await knex.schema.createTable('dictionary_aliases', (t) => {
    t.increments('id').primary();
    t.text('entity_type').notNullable();
    t.integer('entity_id').notNullable();
    t.text('alias').notNullable();
    t.unique(['entity_type', 'entity_id', 'alias']);
  });

  // CHECK constraints defined inline (F5 fix — avoids non-standard ALTER TABLE ADD CONSTRAINT)
  await knex.raw(`
    CREATE TABLE dictionary_artist_memberships (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id     INTEGER NOT NULL REFERENCES dictionary_artists(id) ON DELETE CASCADE,
      group_id      INTEGER          REFERENCES dictionary_groups(id)  ON DELETE SET NULL,
      activity_type TEXT    NOT NULL CHECK (activity_type IN ('group', 'solo')),
      status        TEXT    NOT NULL CHECK (status IN ('active', 'former', 'hiatus')),
      started_at    DATE,
      ended_at      DATE,
      is_primary    INTEGER NOT NULL DEFAULT 0,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await knex.schema.table('dictionary_artist_memberships', (t) => {
    t.index(['artist_id'], 'dictionary_artist_memberships_artist_id_idx');
    t.index(['group_id'], 'dictionary_artist_memberships_group_id_idx');
    t.index(['artist_id', 'activity_type'], 'dictionary_artist_memberships_artist_activity_idx');
    t.index(
      ['artist_id', 'group_id', 'activity_type', 'status'],
      'dictionary_artist_memberships_lookup_idx',
    );
    t.index(
      ['artist_id', 'activity_type', 'started_at'],
      'dictionary_artist_memberships_artist_activity_started_idx',
    );
  });

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

  // ── Videos ────────────────────────────────────────────────────────────────

  await knex.schema.createTable('videos', (t) => {
    t.increments('id').primary();
    t.text('youtube_id').notNullable().unique();
    t.integer('channel_id').unsigned().references('id').inTable('channels').onDelete('CASCADE');
    t.integer('playlist_id').unsigned().references('id').inTable('playlists').onDelete('CASCADE');
    t.text('original_title').notNullable();
    t.text('url');
    t.timestamp('published_at');
    t.text('status').defaultTo('pending');
    t.integer('duplicate_group_id')
      .unsigned()
      .references('id')
      .inTable('duplicate_groups')
      .onDelete('SET NULL');
    t.timestamp('perf_date');
    t.text('group_name');
    t.text('artist_name');
    t.text('event');
    t.text('camera_type');
    t.text('file_path');
    t.text('preview_path');
    t.text('error_log');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.integer('duration_seconds');
    t.text('description');
    t.boolean('is_fancam').nullable();
    t.float('fancam_confidence').nullable();
    t.integer('group_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_groups')
      .onDelete('SET NULL');
    t.integer('artist_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_artists')
      .onDelete('SET NULL');
    t.integer('event_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_events')
      .onDelete('SET NULL');
    t.boolean('is_own_group_song').nullable();
    t.boolean('is_own_artist_song').nullable();
    t.integer('video_list_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('video_lists')
      .onDelete('SET NULL');
  });

  await knex.schema.table('videos', (t) => {
    t.index('status');
    t.index('duplicate_group_id');
    t.index('group_id', 'videos_group_id_idx');
    t.index('artist_id', 'videos_artist_id_idx');
    t.index('event_id', 'videos_event_id_idx');
    t.index('video_list_id', 'idx_videos_video_list_id');
    t.index(['perf_date', 'group_name', 'artist_name', 'event'], 'videos_perf_meta_idx');
  });

  await knex.schema.createTable('status_history', (t) => {
    t.increments('id').primary();
    t.integer('video_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('videos')
      .onDelete('CASCADE');
    t.text('old_status');
    t.text('new_status').notNullable();
    t.timestamp('changed_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('training_data', (t) => {
    t.increments('id').primary();
    t.integer('video_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('videos')
      .onDelete('CASCADE');
    t.text('original_title').notNullable();
    t.jsonb('final_metadata_json');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tags', (t) => {
    t.increments('id').primary();
    t.text('name').notNullable().unique();
  });

  await knex.schema.createTable('video_tags', (t) => {
    t.integer('video_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('videos')
      .onDelete('CASCADE');
    t.integer('tag_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tags')
      .onDelete('CASCADE');
    t.primary(['video_id', 'tag_id']);
  });

  await knex.schema.createTable('event_log', (t) => {
    t.increments('id').primary();
    t.text('event_type').notNullable();
    t.text('description');
    t.text('metadata');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('event_type');
    t.index('created_at');
  });

  await knex.schema.createTable('settings', (t) => {
    t.text('key').primary();
    t.text('value').notNullable();
  });

  // ── Video songs ───────────────────────────────────────────────────────────

  await knex.raw(`
    CREATE TABLE video_songs (
      video_id  INTEGER NOT NULL,
      position  INTEGER NOT NULL,
      raw_title TEXT    NOT NULL,
      song_id   INTEGER NULL,
      PRIMARY KEY (video_id, position),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id)  REFERENCES dictionary_songs(id) ON DELETE SET NULL
    )
  `);

  await knex.raw('CREATE INDEX IF NOT EXISTS video_songs_song_id_idx ON video_songs(song_id)');

  // ── View ──────────────────────────────────────────────────────────────────

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

  // ── updated_at triggers (F6) ──────────────────────────────────────────────

  await knex.raw(`
    CREATE TRIGGER videos_updated_at
    AFTER UPDATE ON videos
    FOR EACH ROW
    BEGIN
      UPDATE videos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  await knex.raw(`
    CREATE TRIGGER video_lists_updated_at
    AFTER UPDATE ON video_lists
    FOR EACH ROW
    BEGIN
      UPDATE video_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  await knex.raw(`
    CREATE TRIGGER dictionary_artist_memberships_updated_at
    AFTER UPDATE ON dictionary_artist_memberships
    FOR EACH ROW
    BEGIN
      UPDATE dictionary_artist_memberships SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP VIEW IF EXISTS videos_display');

  await knex.raw('DROP TRIGGER IF EXISTS videos_updated_at');
  await knex.raw('DROP TRIGGER IF EXISTS video_lists_updated_at');
  await knex.raw('DROP TRIGGER IF EXISTS dictionary_artist_memberships_updated_at');

  await knex.schema.dropTableIfExists('video_songs');
  await knex.schema.dropTableIfExists('video_tags');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('event_log');
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('training_data');
  await knex.schema.dropTableIfExists('status_history');
  await knex.schema.dropTableIfExists('dictionary_song_groups');
  await knex.schema.dropTableIfExists('dictionary_song_artists');
  await knex.schema.dropTableIfExists('dictionary_artist_memberships');
  await knex.schema.dropTableIfExists('dictionary_aliases');
  await knex.schema.dropTableIfExists('dictionary_events');
  await knex.schema.dropTableIfExists('dictionary_songs');
  await knex.schema.dropTableIfExists('dictionary_artists');
  await knex.schema.dropTableIfExists('dictionary_groups');
  await knex.schema.dropTableIfExists('videos');
  await knex.schema.dropTableIfExists('video_lists');
  await knex.schema.dropTableIfExists('duplicate_groups');
  await knex.schema.dropTableIfExists('playlists');
  await knex.schema.dropTableIfExists('channels');
}
