#!/usr/bin/env node
import { knex, addTagToVideo, SHORTS_MAX_DURATION_SECONDS } from '@vidpulse/db';

type VideoRow = { id: number };

async function backfillShortsTags(): Promise<void> {
  const videos = (await knex('videos')
    .select('id')
    .whereNotNull('duration_seconds')
    .where('duration_seconds', '<', SHORTS_MAX_DURATION_SECONDS)) as VideoRow[];

  for (const video of videos) {
    await addTagToVideo(video.id, 'shorts');
  }

  console.log(`Processed videos: ${videos.length}`);
}

backfillShortsTags()
  .then(async () => {
    await knex.destroy();
  })
  .catch(async (error: unknown) => {
    console.error('Backfill shorts tags failed:', error);
    await knex.destroy();
    process.exit(1);
  });
