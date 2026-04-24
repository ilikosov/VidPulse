import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

  await knex.raw('PRAGMA foreign_keys = ON;');

  // Create channels table
  await knex.schema.createTable('channels', (table) => {
    table.increments('id').primary();
    table.string('youtube_id').notNullable().unique();
    table.string('title').notNullable();
    table.string('thumbnail_url');
    table.boolean('is_favorite').defaultTo(false);
    table.timestamp('added_at').defaultTo(knex.fn.now());
    table.timestamp('last_checked_at');
  });

  // Create playlists table
  await knex.schema.createTable('playlists', (table) => {
    table.increments('id').primary();
    table.string('youtube_id').notNullable().unique();
    table.string('title').notNullable();
    table.timestamp('added_at').defaultTo(knex.fn.now());
    table.timestamp('last_checked_at');
  });

  // Create duplicate_groups table (must be created before videos due to FK)
  await knex.schema.createTable('duplicate_groups', (table) => {
    table.increments('id').primary();
    table.integer('primary_video_id').unsigned();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Create videos table
  await knex.schema.createTable('videos', (table) => {
    table.increments('id').primary();
    table.string('youtube_id').notNullable().unique();
    table.integer('channel_id').unsigned().references('id').inTable('channels').onDelete('CASCADE');
    table.integer('playlist_id').unsigned().references('id').inTable('playlists').onDelete('CASCADE');
    table.string('original_title').notNullable();
    table.string('url');
    table.timestamp('published_at');
    table.string('status').defaultTo('pending');
    table.integer('duplicate_group_id').unsigned().references('id').inTable('duplicate_groups').onDelete('SET NULL');
    table.timestamp('perf_date');
    table.string('group_name');
    table.string('artist_name');
    table.string('song_title');
    table.string('event');
    table.string('camera_type');
    table.string('file_path');
    table.string('preview_path');
    table.text('error_log');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Add foreign key to duplicate_groups.primary_video_id after videos table exists
  await knex.schema.alterTable('duplicate_groups', (table) => {
    table.foreign('primary_video_id').references('id').inTable('videos').onDelete('SET NULL');
  });

  // Create status_history table
  await knex.schema.createTable('status_history', (table) => {
    table.increments('id').primary();
    table.integer('video_id').unsigned().notNullable().references('id').inTable('videos').onDelete('CASCADE');
    table.string('old_status');
    table.string('new_status').notNullable();
    table.timestamp('changed_at').defaultTo(knex.fn.now());
  });

  // Create training_data table
  await knex.schema.createTable('training_data', (table) => {
    table.increments('id').primary();
    table.integer('video_id').unsigned().notNullable().references('id').inTable('videos').onDelete('CASCADE');
    table.string('original_title').notNullable();
    table.jsonb('final_metadata_json');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Create indexes
  await knex.schema.alterTable('videos', (table) => {
    table.index('status');
    table.index('duplicate_group_id');
    table.index(['perf_date', 'group_name', 'artist_name', 'song_title', 'event'], 'videos_perf_meta_idx');
  });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_videos_duplicate_group ON videos(duplicate_group_id);');

}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('training_data');
  await knex.schema.dropTableIfExists('status_history');
  await knex.schema.dropTableIfExists('duplicate_groups');
  await knex.schema.dropTableIfExists('videos');
  await knex.schema.dropTableIfExists('playlists');
  await knex.schema.dropTableIfExists('channels');
}
