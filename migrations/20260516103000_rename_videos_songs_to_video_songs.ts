import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasOld = await knex.schema.hasTable('videos_songs');
  const hasNew = await knex.schema.hasTable('video_songs');

  if (hasOld && !hasNew) {
    await knex.schema.renameTable('videos_songs', 'video_songs');
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasOld = await knex.schema.hasTable('videos_songs');
  const hasNew = await knex.schema.hasTable('video_songs');

  if (!hasOld && hasNew) {
    await knex.schema.renameTable('video_songs', 'videos_songs');
  }
}
