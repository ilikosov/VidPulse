import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
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

  await knex.schema.createTable('settings', (t) => {
    t.text('key').primary();
    t.text('value').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('dictionary_events');
  await knex.schema.dropTableIfExists('dictionary_songs');
  await knex.schema.dropTableIfExists('dictionary_artists');
  await knex.schema.dropTableIfExists('dictionary_groups');
}
