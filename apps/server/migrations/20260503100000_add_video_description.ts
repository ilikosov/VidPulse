import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.text('description');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.dropColumn('description');
  });
}
