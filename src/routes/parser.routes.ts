import { Router, Request, Response } from 'express';
import knex from '../db';
import { parseTitle } from '../services/parser/parser.service';

const router = Router();

function validateVideoIds(body: unknown): number[] | null {
  const videoIds = (body as { videoIds?: unknown })?.videoIds;
  if (
    !Array.isArray(videoIds) ||
    videoIds.length === 0 ||
    !videoIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  ) {
    return null;
  }
  return videoIds;
}

router.post('/reparse-all', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'new';

    const videos = await knex('videos')
      .select('id', 'original_title', 'published_at', 'status')
      .where('status', status);

    if (videos.length === 0) {
      return res.json({ message: 'No videos to re-parse', updated: 0 });
    }

    let updated = 0;

    for (const video of videos) {
      try {
        const { metadata, needsReview } = await parseTitle(
          video.original_title,
          video.published_at,
        );

        const updateData: Record<string, string | null> = {
          perf_date: metadata.perf_date
            ? new Date(
                `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
              ).toISOString()
            : null,
          group_name: metadata.group_name || null,
          artist_name: metadata.artist_name || null,
          song_title: metadata.song_title || null,
          event: metadata.event || null,
          camera_type: metadata.camera_type || null,
          status: needsReview ? 'needs_review' : video.status,
        };

        await knex('videos')
          .where('id', video.id)
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          });

        updated += 1;
      } catch (error) {
        console.error(`Error re-parsing video ${video.id}:`, error);
      }
    }

    return res.json({ updated });
  } catch (error) {
    console.error('Error re-parsing videos:', error);
    return res.status(500).json({ error: 'Failed to re-parse videos' });
  }
});

router.post('/reparse-batch', async (req: Request, res: Response) => {
  try {
    const videoIds = validateVideoIds(req.body);
    if (!videoIds) {
      return res
        .status(400)
        .json({ error: 'videoIds must be a non-empty array of positive integers' });
    }

    const videos = await knex('videos')
      .select('id', 'original_title', 'published_at', 'status')
      .whereIn('id', videoIds);

    let updated = 0;

    for (const video of videos) {
      try {
        const { metadata, needsReview } = await parseTitle(
          video.original_title,
          video.published_at,
        );
        const nextStatus = needsReview ? 'needs_review' : video.status;

        const updateData: Record<string, string | null> = {
          perf_date: metadata.perf_date
            ? new Date(
                `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
              ).toISOString()
            : null,
          group_name: metadata.group_name || null,
          artist_name: metadata.artist_name || null,
          song_title: metadata.song_title || null,
          event: metadata.event || null,
          camera_type: metadata.camera_type || null,
          status: nextStatus,
        };

        await knex.transaction(async (trx) => {
          await trx('videos')
            .where('id', video.id)
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            });

          if (nextStatus !== video.status) {
            await trx('status_history').insert({
              video_id: video.id,
              old_status: video.status,
              new_status: nextStatus,
            });
          }
        });

        updated += 1;
      } catch (error) {
        console.error(`Error re-parsing video ${video.id}:`, error);
      }
    }

    return res.json({ updated });
  } catch (error) {
    console.error('Error running batch re-parse:', error);
    return res.status(500).json({ error: 'Failed to run batch re-parse' });
  }
});

export default router;
