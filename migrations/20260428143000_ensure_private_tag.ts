import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    INSERT OR IGNORE INTO tags (name)
    VALUES ('private');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex('tags').where({ name: 'private' }).del();
}
