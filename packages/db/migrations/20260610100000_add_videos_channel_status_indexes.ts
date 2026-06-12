import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_videos_channel_id');
  await knex.raw('DROP INDEX IF EXISTS idx_videos_status');
}
