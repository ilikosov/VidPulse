import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('files', (t) => {
    t.integer('width').nullable();
    t.integer('height').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('files', (t) => {
    t.dropColumn('width');
    t.dropColumn('height');
  });
}
