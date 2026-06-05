import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.boolean('is_fancam').nullable();
    table.float('fancam_confidence').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.dropColumn('is_fancam');
    table.dropColumn('fancam_confidence');
  });
}
