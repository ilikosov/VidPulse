import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.boolean('is_own_artist_song').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.dropColumn('is_own_artist_song');
  });
}
