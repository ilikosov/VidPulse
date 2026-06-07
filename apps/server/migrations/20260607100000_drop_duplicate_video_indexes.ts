import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_videos_status');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_videos_duplicate_group');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status)');
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_videos_duplicate_group ON videos(duplicate_group_id)',
  );
}
