import knex from '../db';
import { logger } from '../lib/logger';
import { parseTitle } from './parser/parser.service';
import { parseTitleWithLLM } from './ai.service';
import { youtubeService } from './youtube.service';
import { hasUnresolvedEntity, resolveParsedMetadata } from './parser/metadataResolver.service';
import { syncVideoSongs } from './parser/videoSongs.service';
import { AppError } from '../middleware/AppError';

function normalizePerfDate(perfDate?: string): string | null {
  if (!perfDate || !/^\d{6}$/.test(perfDate)) return null;
  const date = new Date(
    `20${perfDate.slice(0, 2)}-${perfDate.slice(2, 4)}-${perfDate.slice(4, 6)}`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildMetadataUpdate(metadata: any, resolved: any): Record<string, any> {
  return {
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
  };
}

class ParserService {
  async llmParseVideo(videoId: number): Promise<{ updated: number; metadata: unknown }> {
    const video = await knex('videos').where('id', videoId).first();
    if (!video) throw AppError.notFound('Video not found');

    const metadata = await parseTitleWithLLM(video.original_title, video.description);
    const resolved = await resolveParsedMetadata(metadata);

    await knex('videos').where('id', videoId).update(buildMetadataUpdate(metadata, resolved));
    await syncVideoSongs(videoId, resolved.song_title ?? undefined, metadata.song_titles);

    return { updated: 1, metadata };
  }

  async llmParseBatch(videoIds: number[]): Promise<{ updated: number }> {
    const videos = await knex('videos')
      .select('id', 'original_title', 'description')
      .whereIn('id', videoIds);
    let updated = 0;

    for (const video of videos) {
      try {
        const metadata = await parseTitleWithLLM(video.original_title, video.description);
        const resolved = await resolveParsedMetadata(metadata);
        await knex('videos').where('id', video.id).update(buildMetadataUpdate(metadata, resolved));
        await syncVideoSongs(video.id, resolved.song_title ?? undefined, metadata.song_titles);
        updated += 1;
      } catch (error) {
        logger.error(`Error LLM parsing video ${video.id}:`, error);
      }
    }

    return { updated };
  }

  async reparseAll(status: string): Promise<{ updated: number }> {
    const videos = await knex('videos')
      .select('id', 'youtube_id', 'original_title', 'published_at', 'status')
      .where('status', status);

    if (videos.length === 0) return { updated: 0 };

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

        const updateData: Record<string, any> = {
          ...buildMetadataUpdate(metadata, resolved),
          status: needsReview || forceReview ? 'needs_review' : video.status,
        };

        await knex('videos').where('id', video.id).update(updateData);
        await syncVideoSongs(video.id, resolved.song_title ?? undefined, metadata.song_titles);

        updated += 1;
      } catch (error) {
        logger.error(`Error re-parsing video ${video.id}:`, error);
      }
    }

    return { updated };
  }

  async reparseVideo(videoId: number): Promise<{ video: any; reparseLog: any }> {
    const video = await knex('videos')
      .select('id', 'youtube_id', 'original_title', 'published_at', 'status')
      .where('id', videoId)
      .first();

    if (!video) throw AppError.notFound('Video not found');

    const reparseLog: {
      input: { title: string; publishedAt: string | null; tags?: string[]; description?: string };
      output?: unknown;
      error?: string;
    } = {
      input: { title: video.original_title, publishedAt: video.published_at },
    };

    let metadata: any;
    let needsReview: boolean | undefined;
    try {
      const parseResult = await parseTitle(video.original_title, video.published_at);
      metadata = parseResult.metadata;
      needsReview = parseResult.needsReview;
      reparseLog.output = parseResult;
    } catch (error) {
      reparseLog.error = error instanceof Error ? error.message : 'Unknown parser error';
      throw new AppError(500, 'Failed to re-parse video');
    }

    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);
    const nextStatus = needsReview || forceReview ? 'needs_review' : video.status;

    const updateData: Record<string, any> = {
      ...buildMetadataUpdate(metadata, resolved),
      status: nextStatus,
    };

    await knex.transaction(async (trx: any) => {
      await trx('videos').where('id', video.id).update(updateData);
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
    return { video: updatedVideo, reparseLog };
  }

  async reparseBatch(videoIds: number[]): Promise<{ updated: number }> {
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

        const updateData: Record<string, any> = {
          ...buildMetadataUpdate(metadata, resolved),
          status: nextStatus,
        };

        await knex.transaction(async (trx: any) => {
          await trx('videos').where('id', video.id).update(updateData);
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

    return { updated };
  }
}

export const parserService = new ParserService();
