import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tags', (table) => {
    table.increments('id').primary();
    table.text('name').notNullable().unique();
  });

  await knex.schema.createTable('video_tags', (table) => {
    table.integer('video_id').unsigned().notNullable().references('id').inTable('videos').onDelete('CASCADE');
    table.integer('tag_id').unsigned().notNullable().references('id').inTable('tags').onDelete('CASCADE');
    table.primary(['video_id', 'tag_id']);
  });

  const hasDurationSeconds = await knex.schema.hasColumn('videos', 'duration_seconds');
  if (!hasDurationSeconds) {
    await knex.raw('ALTER TABLE videos ADD COLUMN duration_seconds INTEGER;');
  }

  await knex.raw(`
    INSERT INTO tags (name)
    VALUES ('short'), ('длинное видео'), ('игнорировать видео');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('video_tags');
  await knex.schema.dropTableIfExists('tags');

  const hasDurationSeconds = await knex.schema.hasColumn('videos', 'duration_seconds');
  if (hasDurationSeconds) {
    await knex.raw('ALTER TABLE videos DROP COLUMN duration_seconds;');
  }
}
