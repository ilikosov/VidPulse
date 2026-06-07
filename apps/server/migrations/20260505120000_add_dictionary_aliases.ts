import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dictionary_aliases', (table) => {
    table.increments('id').primary();
    table.text('entity_type').notNullable();
    table.integer('entity_id').notNullable();
    table.text('alias').notNullable();
    table.unique(['entity_type', 'entity_id', 'alias']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dictionary_aliases');
}
