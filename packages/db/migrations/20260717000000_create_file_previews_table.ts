import type { Knex } from 'knex';

/**
 * Persistent storage for generated video preview frames. Each row is one JPEG frame (raw bytes)
 * belonging to a file, ordered by `position`. Rows cascade-delete with their `files` row, so a
 * deleted file leaves no orphan previews. Regeneration replaces a file's rows wholesale.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('file_previews', (t) => {
    t.increments('id').primary();
    t.integer('file_id').notNullable().references('id').inTable('files').onDelete('CASCADE');
    t.integer('position').notNullable();
    t.binary('image').notNullable();
    t.text('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['file_id', 'position']);
    t.index('file_id', 'idx_file_previews_file_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('file_previews');
}
