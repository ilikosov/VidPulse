import { Router, Request, Response } from 'express';
import knex from '../db';
import { parseTitle } from '../services/parser/parser.service';
import { parseTitleWithLLM } from '../services/ai.service';
import { youtubeService } from '../services/youtube.service';
import {
  hasUnresolvedEntity,
  resolveParsedMetadata,
} from '../services/parser/metadataResolver.service';

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

function normalizePerfDate(perfDate?: string): string | null {
  if (!perfDate || !/^\d{6}$/.test(perfDate)) return null;
  const date = new Date(
    `20${perfDate.slice(0, 2)}-${perfDate.slice(2, 4)}-${perfDate.slice(4, 6)}`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

router.post('/llm-parse/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

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
        song_id: resolved.song_id,
        event_id: resolved.event_id,
        group_name: resolved.group_name,
        artist_name: resolved.artist_name,
        song_title: resolved.song_title,
        event: resolved.event,
        camera_type: metadata.camera_type || null,
        is_fancam: metadata.is_fancam ?? null,
        fancam_confidence: metadata.fancam_confidence ?? null,
        is_own_group_song: metadata.is_own_group_song ?? null,
        is_own_artist_song: metadata.is_own_artist_song ?? null,
        updated_at: new Date().toISOString(),
      });

    return res.json({ updated: 1, metadata });
  } catch (error) {
    console.error('Error in LLM parse:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Failed LLM parse' });
  }
});

router.post('/llm-parse-batch', async (req: Request, res: Response) => {
  try {
    const videoIds = validateVideoIds(req.body);
    if (!videoIds) {
      return res
        .status(400)
        .json({ error: 'videoIds must be a non-empty array of positive integers' });
    }

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
            song_id: resolved.song_id,
            event_id: resolved.event_id,
            group_name: resolved.group_name,
            artist_name: resolved.artist_name,
            song_title: resolved.song_title,
            event: resolved.event,
            camera_type: metadata.camera_type || null,
            is_fancam: metadata.is_fancam ?? null,
            fancam_confidence: metadata.fancam_confidence ?? null,
            is_own_group_song: metadata.is_own_group_song ?? null,
            is_own_artist_song: metadata.is_own_artist_song ?? null,
            updated_at: new Date().toISOString(),
          });
        updated += 1;
      } catch (error) {
        console.error(`Error LLM parsing video ${video.id}:`, error);
      }
    }

    return res.json({ updated });
  } catch (error) {
    console.error('Error in batch LLM parse:', error);
    return res.status(500).json({ error: 'Failed batch LLM parse' });
  }
});
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
          song_id: resolved.song_id,
          event_id: resolved.event_id,
          group_name: resolved.group_name,
          artist_name: resolved.artist_name,
          song_title: resolved.song_title,
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

router.post('/reparse/:id', async (req: Request, res: Response) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

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
      song_id: resolved.song_id,
      event_id: resolved.event_id,
      group_name: resolved.group_name,
      artist_name: resolved.artist_name,
      song_title: resolved.song_title,
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
    console.error('Error re-parsing single video:', error);
    return res.status(500).json({ error: 'Failed to re-parse video' });
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
          song_id: resolved.song_id,
          event_id: resolved.event_id,
          group_name: resolved.group_name,
          artist_name: resolved.artist_name,
          song_title: resolved.song_title,
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
