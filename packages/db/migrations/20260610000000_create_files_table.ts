import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('files', (t) => {
    t.increments('id').primary();
    t.text('filename').notNullable();
    t.text('directory').notNullable();
    t.text('extension').nullable();
    t.integer('size_bytes').nullable();
    t.text('youtube_id').nullable();
    t.integer('video_id').nullable().references('id').inTable('videos').onDelete('SET NULL');
    t.text('scanned_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['directory', 'filename']);
    t.index('youtube_id', 'idx_files_youtube_id');
    t.index('video_id', 'idx_files_video_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('files');
}
