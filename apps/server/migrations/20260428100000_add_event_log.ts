import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('event_log', (table) => {
    table.increments('id').primary();
    table.string('event_type').notNullable();
    table.text('description');
    table.text('metadata');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('event_log', (table) => {
    table.index('event_type');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_log');
}
