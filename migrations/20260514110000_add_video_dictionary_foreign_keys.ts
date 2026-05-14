import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table
      .integer('group_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_groups')
      .onDelete('SET NULL');
    table
      .integer('artist_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_artists')
      .onDelete('SET NULL');
    table
      .integer('song_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_songs')
      .onDelete('SET NULL');
    table
      .integer('event_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dictionary_events')
      .onDelete('SET NULL');
  });

  await knex.schema.alterTable('videos', (table) => {
    table.index(['group_id'], 'videos_group_id_idx');
    table.index(['artist_id'], 'videos_artist_id_idx');
    table.index(['song_id'], 'videos_song_id_idx');
    table.index(['event_id'], 'videos_event_id_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.dropIndex(['group_id'], 'videos_group_id_idx');
    table.dropIndex(['artist_id'], 'videos_artist_id_idx');
    table.dropIndex(['song_id'], 'videos_song_id_idx');
    table.dropIndex(['event_id'], 'videos_event_id_idx');
  });

  await knex.schema.alterTable('videos', (table) => {
    table.dropColumn('group_id');
    table.dropColumn('artist_id');
    table.dropColumn('song_id');
    table.dropColumn('event_id');
  });
}
