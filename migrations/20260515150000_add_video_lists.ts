import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('video_lists', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('color').notNullable().unique();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('videos', (table) => {
    table
      .integer('video_list_id')
      .unsigned()
      .references('id')
      .inTable('video_lists')
      .onDelete('SET NULL');
  });

  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_videos_video_list_id ON videos(video_list_id);',
  );
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('videos', 'video_list_id');
  if (hasColumn) {
    await knex.schema.alterTable('videos', (table) => {
      table.dropColumn('video_list_id');
    });
  }

  await knex.schema.dropTableIfExists('video_lists');
}
