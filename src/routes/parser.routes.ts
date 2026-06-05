import { Router, Request, Response } from 'express';
import knex from '../db';
import { logger } from '../lib/logger';
import { parseTitle } from '../services/parser/parser.service';
import { parseTitleWithLLM } from '../services/ai.service';
import { youtubeService } from '../services/youtube.service';
import {
  hasUnresolvedEntity,
  resolveParsedMetadata,
} from '../services/parser/metadataResolver.service';
import { syncVideoSongs } from '../services/parser/videoSongs.service';
import { validateBody, validateParams } from '../middleware/validate';
import parserLlmBatchSchema from '../schemas/request/parser-llm-batch.schema.json';
import batchVideoIdsSchema from '../schemas/request/batch-video-ids.schema.json';
import paramsIdSchema from '../schemas/request/params-id.schema.json';

const router = Router();

function normalizePerfDate(perfDate?: string): string | null {
  if (!perfDate || !/^\d{6}$/.test(perfDate)) return null;
  const date = new Date(
    `20${perfDate.slice(0, 2)}-${perfDate.slice(2, 4)}-${perfDate.slice(4, 6)}`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

router.post(
  '/llm-parse/:id',
  validateParams(paramsIdSchema),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      const video = await knex('videos').where('id', id).first();
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const metadata = await parseTitleWithLLM(video.original_title, video.description);
      const resolved = await resolveParsedMetadata(metadata);

      await knex('videos')
        .where('id', id)
        .update({
          perf_date: normalizePerfDate(metadata.perf_date),
          group_id: resolved.group_id,
          artist_id: resolved.artist_id,
          event_id: resolved.event_id,
          group_name: resolved.group_name,
          artist_name: resolved.artist_name,
          event: resolved.event,
          camera_type: metadata.camera_type || null,
          is_fancam: metadata.is_fancam ?? null,
          fancam_confidence: metadata.fancam_confidence ?? null,
          is_own_group_song: metadata.is_own_group_song ?? null,
          is_own_artist_song: metadata.is_own_artist_song ?? null,
          updated_at: new Date().toISOString(),
        });
      await syncVideoSongs(id, resolved.song_title ?? undefined, metadata.song_titles);

      return res.json({ updated: 1, metadata });
    } catch (error) {
      logger.error('Error in LLM parse:', error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed LLM parse' });
    }
  },
);

router.post(
  '/llm-parse-batch',
  validateBody(parserLlmBatchSchema),
  async (req: Request, res: Response) => {
    try {
      const videoIds: number[] = req.body.videoIds;

      const videos = await knex('videos').select('id', 'original_title').whereIn('id', videoIds);
      let updated = 0;

      for (const video of videos) {
        try {
          const metadata = await parseTitleWithLLM(video.original_title, video.description);
          const resolved = await resolveParsedMetadata(metadata);
          await knex('videos')
            .where('id', video.id)
            .update({
              perf_date: normalizePerfDate(metadata.perf_date),
              group_id: resolved.group_id,
              artist_id: resolved.artist_id,
              event_id: resolved.event_id,
              group_name: resolved.group_name,
              artist_name: resolved.artist_name,
              event: resolved.event,
              camera_type: metadata.camera_type || null,
              is_fancam: metadata.is_fancam ?? null,
              fancam_confidence: metadata.fancam_confidence ?? null,
              is_own_group_song: metadata.is_own_group_song ?? null,
              is_own_artist_song: metadata.is_own_artist_song ?? null,
              updated_at: new Date().toISOString(),
            });
          await syncVideoSongs(video.id, resolved.song_title ?? undefined, metadata.song_titles);
          updated += 1;
        } catch (error) {
          logger.error(`Error LLM parsing video ${video.id}:`, error);
        }
      }

      return res.json({ updated });
    } catch (error) {
      logger.error('Error in batch LLM parse:', error);
      return res.status(500).json({ error: 'Failed batch LLM parse' });
    }
  },
);
router.post('/reparse-all', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'new';

    const videos = await knex('videos')
      .select('id', 'youtube_id', 'original_title', 'published_at', 'status')
      .where('status', status);

    if (videos.length === 0) {
      return res.json({ message: 'No videos to re-parse', updated: 0 });
    }

    let updated = 0;

    for (const video of videos) {
      try {
        const details = await youtubeService.getVideoDetails(video.youtube_id);
        const { metadata, needsReview } = await parseTitle(
          details.title || video.original_title,
          details.publishedAt || video.published_at,
          details.tags,
        );

        const resolved = await resolveParsedMetadata(metadata);
        const forceReview = hasUnresolvedEntity(metadata, resolved);

        const updateData: Record<string, string | number | boolean | null> = {
          perf_date: metadata.perf_date
            ? new Date(
                `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
              ).toISOString()
            : null,
          group_id: resolved.group_id,
          artist_id: resolved.artist_id,
          event_id: resolved.event_id,
          group_name: resolved.group_name,
          artist_name: resolved.artist_name,
          event: resolved.event,
          camera_type: metadata.camera_type || null,
          is_fancam: metadata.is_fancam ?? null,
          fancam_confidence: metadata.fancam_confidence ?? null,
          is_own_group_song: metadata.is_own_group_song ?? null,
          is_own_artist_song: metadata.is_own_artist_song ?? null,
          status: needsReview || forceReview ? 'needs_review' : video.status,
        };

        await knex('videos')
          .where('id', video.id)
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          });
        await syncVideoSongs(video.id, resolved.song_title ?? undefined, metadata.song_titles);

        updated += 1;
      } catch (error) {
        logger.error(`Error re-parsing video ${video.id}:`, error);
      }
    }

    return res.json({ updated });
  } catch (error) {
    logger.error('Error re-parsing videos:', error);
    return res.status(500).json({ error: 'Failed to re-parse videos' });
  }
});

router.post('/reparse/:id', validateParams(paramsIdSchema), async (req: Request, res: Response) => {
  try {
    const videoId = Number(req.params.id);

    const video = await knex('videos')
      .select('id', 'youtube_id', 'original_title', 'published_at', 'status')
      .where('id', videoId)
      .first();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const reparseLog: {
      input: {
        title: string;
        publishedAt: string | null;
        tags?: string[];
        description?: string;
      };
      output?: unknown;
      error?: string;
    } = {
      input: {
        title: video.original_title,
        publishedAt: video.published_at,
      },
    };

    let metadata;
    let needsReview;
    try {
      const parseResult = await parseTitle(video.original_title, video.published_at);
      metadata = parseResult.metadata;
      needsReview = parseResult.needsReview;
      reparseLog.output = parseResult;
    } catch (error) {
      reparseLog.error = error instanceof Error ? error.message : 'Unknown parser error';
      return res.status(500).json({ error: 'Failed to re-parse video', reparseLog });
    }
    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);
    const nextStatus = needsReview || forceReview ? 'needs_review' : 'new';

    const updateData: Record<string, string | number | boolean | null> = {
      perf_date: metadata.perf_date
        ? new Date(
            `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
          ).toISOString()
        : null,
      group_id: resolved.group_id,
      artist_id: resolved.artist_id,
      event_id: resolved.event_id,
      group_name: resolved.group_name,
      artist_name: resolved.artist_name,
      event: resolved.event,
      camera_type: metadata.camera_type || null,
      is_fancam: metadata.is_fancam ?? null,
      fancam_confidence: metadata.fancam_confidence ?? null,
      is_own_group_song: metadata.is_own_group_song ?? null,
      is_own_artist_song: metadata.is_own_artist_song ?? null,
      status: nextStatus,
    };

    await knex.transaction(async (trx) => {
      await trx('videos')
        .where('id', video.id)
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        });
      await syncVideoSongs(video.id, resolved.song_title ?? undefined, metadata.song_titles, trx);

      if (nextStatus !== video.status) {
        await trx('status_history').insert({
          video_id: video.id,
          old_status: video.status,
          new_status: nextStatus,
        });
      }
    });

    const updatedVideo = await knex('videos').where('id', video.id).first();
    return res.json({ video: updatedVideo, reparseLog });
  } catch (error) {
    logger.error('Error re-parsing single video:', error);
    return res.status(500).json({ error: 'Failed to re-parse video' });
  }
});

router.post(
  '/reparse-batch',
  validateBody(batchVideoIdsSchema),
  async (req: Request, res: Response) => {
    try {
      const videoIds: number[] = req.body.videoIds;

      const videos = await knex('videos')
        .select('id', 'youtube_id', 'original_title', 'published_at', 'status')
        .whereIn('id', videoIds);

      let updated = 0;

      for (const video of videos) {
        try {
          const details = await youtubeService.getVideoDetails(video.youtube_id);
          const { metadata, needsReview } = await parseTitle(
            details.title || video.original_title,
            details.publishedAt || video.published_at,
            details.tags,
          );
          const resolved = await resolveParsedMetadata(metadata);
          const forceReview = hasUnresolvedEntity(metadata, resolved);
          const nextStatus = needsReview || forceReview ? 'needs_review' : video.status;

          const updateData: Record<string, string | number | boolean | null> = {
            perf_date: metadata.perf_date
              ? new Date(
                  `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
                ).toISOString()
              : null,
            group_id: resolved.group_id,
            artist_id: resolved.artist_id,
            event_id: resolved.event_id,
            group_name: resolved.group_name,
            artist_name: resolved.artist_name,
            event: resolved.event,
            camera_type: metadata.camera_type || null,
            is_fancam: metadata.is_fancam ?? null,
            fancam_confidence: metadata.fancam_confidence ?? null,
            is_own_group_song: metadata.is_own_group_song ?? null,
            is_own_artist_song: metadata.is_own_artist_song ?? null,
            status: nextStatus,
          };

          await knex.transaction(async (trx) => {
            await trx('videos')
              .where('id', video.id)
              .update({
                ...updateData,
                updated_at: new Date().toISOString(),
              });
            await syncVideoSongs(
              video.id,
              resolved.song_title ?? undefined,
              metadata.song_titles,
              trx,
            );

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
          logger.error(`Error re-parsing video ${video.id}:`, error);
        }
      }

      return res.json({ updated });
    } catch (error) {
      logger.error('Error running batch re-parse:', error);
      return res.status(500).json({ error: 'Failed to run batch re-parse' });
    }
  },
);

export default router;
