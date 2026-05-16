import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('videos_songs', (table) => {
    table
      .integer('video_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('videos')
      .onDelete('CASCADE');
    table
      .integer('song_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('dictionary_songs')
      .onDelete('CASCADE');
    table.primary(['video_id', 'song_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('videos_songs');
}
