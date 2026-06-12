import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('video_lists', (t) => {
    t.text('status').nullable();
    t.index('status', 'idx_video_lists_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('video_lists', (t) => {
    t.dropIndex('status', 'idx_video_lists_status');
    t.dropColumn('status');
  });
}
