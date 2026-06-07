import { Router, Request, Response } from 'express';
import knex from '../db';
import { logger } from '../lib/logger';
import { parseTitle } from '../services/parser/parser.service';
import {
  hasUnresolvedEntity,
  resolveParsedMetadata,
} from '../services/parser/metadataResolver.service';
import * as fs from 'fs';
import * as path from 'path';
import { youtubeService } from '../services/youtube.service';
import { logEvent } from '../services/eventLog.service';
import {
  LEGACY_SHORT_TAG,
  LONG_VIDEO_TAG,
  SHORTS_TAG,
  assignAutoTags,
  mergeShortTags,
  tagLongVideosByDuration,
  tagShortsByDuration,
} from '../services/tag.service';
import { VALID_STATUSES, isValidStatus } from '../models/videoStatus';
import { parseTitleWithLLM } from '../services/ai.service';
import { buildPaginationMeta, getPaginationParams } from './pagination';
import { requireDangerousActionsEnabled } from '../middleware/dangerousActions';
import { syncVideoSongs, getVideoSongsMap } from '../services/parser/videoSongs.service';
import { splitSongTitles } from '../services/parser/songTitles.util';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';
import batchVideoIdsSchema from '../../schemas/request/batch-video-ids.schema.json';
import batchTagsSchema from '../../schemas/request/batch-tags.schema.json';
import videoAddSchema from '../../schemas/request/video-add.schema.json';
import videoTagsSchema from '../../schemas/request/video-tags.schema.json';
import videoMetadataSchema from '../../schemas/request/video-metadata.schema.json';
import paramsIdSchema from '../../schemas/request/params-id.schema.json';
import paramsIdTagIdSchema from '../../schemas/request/params-id-tagId.schema.json';

const router = Router();

const PROTECTED_TAGS = new Set([SHORTS_TAG, LONG_VIDEO_TAG, 'private']);

async function findOrCreateTagId(tagName: string): Promise<number> {
  const existingTag = await knex('tags').whereRaw('LOWER(name) = LOWER(?)', [tagName]).first();
  if (existingTag) {
    return existingTag.id;
  }
  const insertResult = await knex('tags').insert({ name: tagName }).returning('id');
  const inserted = Array.isArray(insertResult) ? insertResult[0] : insertResult;
  return typeof inserted === 'object' ? inserted.id : inserted;
}

async function getVideoTagsMap(videoIds: number[]) {
  const rows = await knex('video_tags')
    .join('tags', 'video_tags.tag_id', 'tags.id')
    .select('video_tags.video_id', 'tags.id', 'tags.name')
    .whereIn('video_tags.video_id', videoIds)
    .orderBy('tags.name', 'asc');

  const tagsByVideo = new Map<number, Array<{ id: number; name: string }>>();
  for (const row of rows) {
    const tags = tagsByVideo.get(row.video_id) ?? [];
    tags.push({ id: row.id, name: row.name });
    tagsByVideo.set(row.video_id, tags);
  }
  return tagsByVideo;
}

function isConfirmationRequired(tagName: string): boolean {
  return PROTECTED_TAGS.has(tagName.trim().toLowerCase());
}

function applyVideoFilters(
  query: ReturnType<typeof knex>,
  filters: { status?: string; includeIgnored: boolean; channelId?: string },
) {
  const { status, includeIgnored, channelId } = filters;
  if (channelId) query.where('videos.channel_id', channelId);
  if (status) query.where('videos.status', status);
  else if (!includeIgnored) query.whereNot('videos.status', 'ignored');
  if (process.env.HIDE_FLAGGED_VIDEOS === 'true') {
    query.whereNotIn('videos.id', function () {
      this.select('v2.id')
        .from('videos as v2')
        .join('video_tags as vt', 'vt.video_id', 'v2.id')
        .join('tags as t', 't.id', 'vt.tag_id')
        .whereIn('t.name', [SHORTS_TAG, 'private']);
    });
  }
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const status = req.query.status as string | undefined;
    const includeIgnored = req.query.includeIgnored === 'true';
    const channelId = req.query.channel_id as string | undefined;

    if (status && !isValidStatus(status)) {
      return res.status(400).json({
        error: { message: `Invalid status '${status}'. Allowed: ${VALID_STATUSES.join(', ')}` },
      });
    }

    let query = knex('videos_display as videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select(
        'videos.id',
        'videos.youtube_id',
        'videos.channel_id',
        'videos.playlist_id',
        'videos.original_title',
        'videos.description',
        'videos.perf_date',
        'videos.group_name',
        'videos.artist_name',
        'videos.event',
        'videos.camera_type',
        'videos.duration_seconds',
        'videos.status',
        'videos.created_at',
        'videos.updated_at',
        'channels.title as channel_title',
        'playlists.title as playlist_title',
      );

    applyVideoFilters(query, { status, includeIgnored, channelId });
    query = query.orderBy('videos.created_at', 'desc');

    const videos = await query.limit(limit).offset(offset);
    const videoIds = videos.map((video) => video.id);
    const tagsByVideo = videoIds.length > 0 ? await getVideoTagsMap(videoIds) : new Map();
    const songsByVideo = await getVideoSongsMap(videoIds);
    const videosWithTags = videos.map((video) => ({
      ...video,
      tags: tagsByVideo.get(video.id) ?? [],
      songs: songsByVideo.get(video.id) ?? [],
    }));

    const totalQuery = knex('videos');
    applyVideoFilters(totalQuery, { status, includeIgnored, channelId });
    const total = await totalQuery.count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    res.json({
      videos: videosWithTags,
      pagination: buildPaginationMeta(page, limit, totalCount),
    });
  }),
);

router.post(
  '/batch/confirm-download',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of videoIds) {
      try {
        const video = await knex('videos').where('id', videoId).first();
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        if (video.status !== 'new') {
          errors.push({ videoId, error: `Invalid status '${video.status}'. Expected 'new'.` });
          continue;
        }
        const filePath = path.join(process.cwd(), 'downloads', video.youtube_id, 'original.mp4');
        if (!fs.existsSync(filePath)) {
          errors.push({ videoId, error: `Download file missing at ${filePath}` });
          continue;
        }
        await knex.transaction(async (trx) => {
          await trx('videos').where('id', videoId).update({
            status: 'downloaded',
            file_path: filePath,
            updated_at: new Date().toISOString(),
          });
          await trx('status_history').insert({
            video_id: videoId,
            old_status: video.status,
            new_status: 'downloaded',
          });
        });
        await logEvent(
          'video_download_confirmed',
          `Download confirmed for video ${video.youtube_id}`,
          { video_id: videoId, youtube_id: video.youtube_id, file_path: filePath },
        );
        succeeded += 1;
      } catch (error) {
        logger.error(`Error confirming download for video ${videoId}:`, error);
        errors.push({ videoId, error: 'Internal error while confirming download' });
      }
    }

    return res.json({
      processed: videoIds.length,
      succeeded,
      failed: videoIds.length - succeeded,
      errors,
    });
  }),
);

router.post(
  '/batch/complete',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;
    const allowedStatuses = ['thumbnails_generated', 'ready_for_upload'];

    for (const videoId of videoIds) {
      try {
        const video = await knex('videos').where('id', videoId).first();
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        if (!allowedStatuses.includes(video.status)) {
          errors.push({
            videoId,
            error: `Invalid status '${video.status}'. Expected one of: ${allowedStatuses.join(', ')}`,
          });
          continue;
        }
        const downloadDir = path.join(process.cwd(), 'downloads', video.youtube_id);
        const previewDir = path.join(process.cwd(), 'previews', video.youtube_id);
        if (fs.existsSync(downloadDir)) fs.rmSync(downloadDir, { recursive: true, force: true });
        if (fs.existsSync(previewDir)) fs.rmSync(previewDir, { recursive: true, force: true });
        await knex.transaction(async (trx) => {
          await trx('videos').where('id', videoId).update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          });
          await trx('status_history').insert({
            video_id: videoId,
            old_status: video.status,
            new_status: 'completed',
          });
        });
        await logEvent('video_completed', `Video marked completed: ${video.youtube_id}`, {
          video_id: videoId,
          youtube_id: video.youtube_id,
          old_status: video.status,
        });
        succeeded += 1;
      } catch (error) {
        logger.error(`Error completing video ${videoId}:`, error);
        errors.push({ videoId, error: 'Internal error while completing video' });
      }
    }

    return res.json({
      processed: videoIds.length,
      succeeded,
      failed: videoIds.length - succeeded,
      errors,
    });
  }),
);

router.post(
  '/batch/ignore',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of videoIds) {
      try {
        const video = await knex('videos').where('id', videoId).first();
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        if (video.status === 'completed') {
          errors.push({ videoId, error: "Cannot ignore videos with status 'completed'" });
          continue;
        }
        if (video.status === 'ignored') {
          succeeded += 1;
          continue;
        }
        await knex.transaction(async (trx) => {
          await trx('videos').where('id', videoId).update({
            status: 'ignored',
            updated_at: new Date().toISOString(),
          });
          await trx('status_history').insert({
            video_id: videoId,
            old_status: video.status,
            new_status: 'ignored',
          });
        });
        succeeded += 1;
      } catch (error) {
        logger.error(`Error ignoring video ${videoId}:`, error);
        errors.push({ videoId, error: 'Internal error while ignoring video' });
      }
    }

    return res.json({
      processed: videoIds.length,
      succeeded,
      failed: videoIds.length - succeeded,
      errors,
    });
  }),
);

router.post(
  '/batch/tag-shorts-by-duration',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await tagShortsByDuration();
    res.json(summary);
  }),
);

router.post(
  '/batch/tag-long-videos-by-duration',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await tagLongVideosByDuration();
    res.json(summary);
  }),
);

router.post(
  '/batch/merge-short-tags',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await mergeShortTags();
    res.json(summary);
  }),
);

router.post(
  '/:id/ignore',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid video id' } });
    }
    const video = await knex('videos').where('id', videoId).first();
    if (!video) throw AppError.notFound('Video not found');
    if (video.status === 'completed') {
      throw AppError.badRequest("Cannot ignore videos with status 'completed'");
    }
    if (video.status !== 'ignored') {
      await knex.transaction(async (trx) => {
        await trx('videos').where('id', videoId).update({
          status: 'ignored',
          updated_at: new Date().toISOString(),
        });
        await trx('status_history').insert({
          video_id: videoId,
          old_status: video.status,
          new_status: 'ignored',
        });
      });
    }
    const updatedVideo = await knex('videos_display as videos').where('videos.id', videoId).first();
    return res.json(updatedVideo);
  }),
);

router.post(
  '/batch/tags',
  validateBody(batchTagsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { videoIds, tagName, confirm } = req.body as {
      videoIds: number[];
      tagName: string;
      confirm?: boolean;
    };

    if (isConfirmationRequired(tagName) && confirm !== true) {
      return res.status(400).json({
        error: { message: `Adding "${tagName}" tag requires confirmation` },
        requiresConfirmation: true,
      });
    }

    const tagId = await findOrCreateTagId(tagName);
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of videoIds) {
      try {
        const video = await knex('videos').where('id', videoId).first();
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        await knex('video_tags')
          .insert({ video_id: videoId, tag_id: tagId })
          .onConflict(['video_id', 'tag_id'])
          .ignore();
        succeeded += 1;
      } catch (error) {
        logger.error(`Error adding tag for video ${videoId}:`, error);
        errors.push({ videoId, error: 'Failed to add tag to video' });
      }
    }

    return res.json({
      processed: videoIds.length,
      succeeded,
      failed: videoIds.length - succeeded,
      errors,
    });
  }),
);

router.delete(
  '/batch/tags',
  validateBody(batchTagsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { videoIds, tagName } = req.body as { videoIds: number[]; tagName: string };

    const tag = await knex('tags').whereRaw('LOWER(name) = LOWER(?)', [tagName]).first();
    if (!tag) {
      return res.json({
        processed: videoIds.length,
        succeeded: videoIds.length,
        failed: 0,
        errors: [],
      });
    }

    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of videoIds) {
      try {
        const video = await knex('videos').where('id', videoId).first();
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        await knex('video_tags').where({ video_id: videoId, tag_id: tag.id }).del();
        succeeded += 1;
      } catch (error) {
        logger.error(`Error removing tag for video ${videoId}:`, error);
        errors.push({ videoId, error: 'Failed to remove tag from video' });
      }
    }

    return res.json({
      processed: videoIds.length,
      succeeded,
      failed: videoIds.length - succeeded,
      errors,
    });
  }),
);

router.post(
  '/add',
  validateBody(videoAddSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { url } = req.body as { url: string };
    const trimmed = url.trim();
    const videoId =
      trimmed.match(/^[a-zA-Z0-9_-]{11}$/)?.[0] ??
      trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1] ??
      trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1] ??
      trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)?.[1] ??
      trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)?.[1];

    if (!videoId) throw AppError.badRequest('Invalid YouTube video URL');

    const existingVideo = await knex('videos').where('youtube_id', videoId).first();
    if (existingVideo) {
      return res.status(409).json({ error: { message: 'Video already exists' } });
    }

    let details;
    try {
      details = await youtubeService.getVideoDetails(videoId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Video not found')) {
        throw AppError.notFound('Video not found on YouTube');
      }
      throw error;
    }

    const { metadata } = await parseTitle(details.title, details.publishedAt, details.tags);
    const resolved = await resolveParsedMetadata(metadata);

    const insertData: Record<string, string | number | boolean | null> = {
      youtube_id: videoId,
      original_title: details.title,
      url: url.trim(),
      published_at: details.publishedAt || null,
      status: 'needs_review',
      description: details.description ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (metadata.perf_date) {
      const dateStr = metadata.perf_date;
      insertData.perf_date = new Date(
        `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
      ).toISOString();
    }
    insertData.group_id = resolved.group_id;
    insertData.artist_id = resolved.artist_id;
    insertData.event_id = resolved.event_id;
    insertData.group_name = resolved.group_name;
    insertData.artist_name = resolved.artist_name;
    insertData.event = resolved.event;
    if (metadata.camera_type !== undefined) insertData.camera_type = metadata.camera_type || null;
    insertData.is_fancam = metadata.is_fancam ?? null;
    insertData.fancam_confidence = metadata.fancam_confidence ?? null;
    insertData.is_own_group_song = metadata.is_own_group_song ?? null;
    insertData.is_own_artist_song = metadata.is_own_artist_song ?? null;

    let createdVideo;
    try {
      [createdVideo] = await knex('videos').insert(insertData).returning('*');
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE')
      ) {
        return res.status(409).json({ error: { message: 'Video already exists' } });
      }
      throw error;
    }

    await syncVideoSongs(createdVideo.id, resolved.song_title ?? undefined, metadata.song_titles);
    await assignAutoTags(createdVideo.id, details.durationSeconds, details.privacyStatus);
    await logEvent('video_added_manual', `Manual video added: ${createdVideo.original_title}`, {
      video_id: createdVideo.id,
      youtube_id: createdVideo.youtube_id,
      status: createdVideo.status,
    });

    return res.status(201).json(createdVideo);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const video = await knex('videos_display as videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select(
        'videos.*',
        'channels.title as channel_title',
        'channels.youtube_id as channel_youtube_id',
        'playlists.title as playlist_title',
      )
      .where('videos.id', id)
      .first();

    if (!video) throw AppError.notFound('Video not found');

    const tags = await knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('tags.id', 'tags.name')
      .where('video_tags.video_id', video.id)
      .orderBy('tags.name', 'asc');

    const songs = (await getVideoSongsMap([video.id])).get(video.id) ?? [];
    res.json({ ...video, tags, songs });
  }),
);

router.post(
  '/:id/suggest',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');

    const video = await knex('videos')
      .select('id', 'original_title', 'description')
      .where('id', videoId)
      .first();
    if (!video) throw AppError.notFound('Video not found');

    try {
      const suggestion = await parseTitleWithLLM(video.original_title, video.description ?? '');
      return res.json(suggestion);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI suggestion failed';
      throw new AppError(502, `AI suggestion failed: ${message}`);
    }
  }),
);

router.post(
  '/:id/resync',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');

    const existingVideo = await knex('videos').where('id', videoId).first();
    if (!existingVideo) throw AppError.notFound('Video not found');

    const resyncLog: {
      youtubeResponse?: unknown;
      youtubeError?: string;
      parseLog: {
        input: { title: string; publishedAt?: string; tags?: string[]; description?: string };
        output?: unknown;
        error?: string;
      };
    } = { parseLog: { input: { title: '' } } };

    let details;
    try {
      details = await youtubeService.getVideoDetails(existingVideo.youtube_id);
    } catch (error) {
      await knex('videos')
        .where('id', videoId)
        .update({ status: 'error', updated_at: new Date().toISOString() });
      await logEvent('video_resync_failed', `Failed to resync video ${existingVideo.youtube_id}`, {
        video_id: videoId,
        youtube_id: existingVideo.youtube_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      resyncLog.youtubeError = error instanceof Error ? error.message : 'Unknown YouTube error';
      throw new AppError(502, 'Failed to fetch latest YouTube details');
    }

    resyncLog.youtubeResponse = {
      title: details.title,
      channelId: details.channelId,
      publishedAt: details.publishedAt,
      durationSeconds: details.durationSeconds,
      privacyStatus: details.privacyStatus,
      tags: details.tags,
      description: details.description,
    };
    resyncLog.parseLog.input = {
      title: details.title,
      publishedAt: details.publishedAt,
      tags: details.tags,
      description: details.description,
    };

    let metadata;
    let needsReview;
    try {
      const parseResult = await parseTitle(details.title, details.publishedAt, details.tags);
      metadata = parseResult.metadata;
      needsReview = parseResult.needsReview;
      resyncLog.parseLog.output = parseResult;
    } catch (error) {
      resyncLog.parseLog.error = error instanceof Error ? error.message : 'Unknown parser error';
      throw AppError.internal('Failed to parse fresh metadata');
    }

    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);

    const updatedVideo = await knex.transaction(async (trx) => {
      const updateData: Record<string, unknown> = {
        original_title: details.title,
        description: details.description || null,
        duration_seconds: details.durationSeconds ?? null,
        published_at: details.publishedAt || existingVideo.published_at || null,
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
        status: needsReview || forceReview ? 'needs_review' : 'new',
        updated_at: new Date().toISOString(),
      };

      await trx('videos').where('id', videoId).update(updateData);
      await syncVideoSongs(videoId, resolved.song_title ?? undefined, metadata.song_titles, trx);

      const autoTagIds = await trx('tags')
        .select('id')
        .whereIn('name', [SHORTS_TAG, LEGACY_SHORT_TAG, 'private', 'длинное видео']);
      if (autoTagIds.length > 0) {
        await trx('video_tags')
          .where('video_id', videoId)
          .whereIn(
            'tag_id',
            autoTagIds.map((tag) => tag.id),
          )
          .del();
      }

      await assignAutoTags(videoId, details.durationSeconds, details.privacyStatus);

      if (existingVideo.status !== updateData.status) {
        await trx('status_history').insert({
          video_id: videoId,
          old_status: existingVideo.status,
          new_status: updateData.status as string,
        });
      }

      return trx('videos').where('id', videoId).first();
    });

    await logEvent('video_resynced', `Video resynced ${existingVideo.youtube_id}`, {
      video_id: videoId,
      youtube_id: existingVideo.youtube_id,
    });

    const tags = await knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('tags.id', 'tags.name')
      .where('video_tags.video_id', videoId)
      .orderBy('tags.name', 'asc');

    return res.json({ video: { ...updatedVideo, tags }, resyncLog });
  }),
);

router.get(
  '/:id/tags',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');

    const video = await knex('videos').where('id', videoId).first();
    if (!video) throw AppError.notFound('Video not found');

    const tags = await knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('tags.id', 'tags.name')
      .where('video_tags.video_id', videoId)
      .orderBy('tags.name', 'asc');

    return res.json(tags);
  }),
);

router.post(
  '/:id/tags',
  validateParams(paramsIdSchema),
  validateBody(videoTagsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    const { name: tagName, confirm } = req.body as { name: string; confirm?: boolean };

    if (isConfirmationRequired(tagName) && confirm !== true) {
      return res.status(400).json({
        error: { message: `Adding "${tagName}" tag requires confirmation` },
        requiresConfirmation: true,
      });
    }

    const video = await knex('videos').where('id', videoId).first();
    if (!video) throw AppError.notFound('Video not found');

    const tagId = await findOrCreateTagId(tagName);
    await knex('video_tags')
      .insert({ video_id: videoId, tag_id: tagId })
      .onConflict(['video_id', 'tag_id'])
      .ignore();

    const tag = await knex('tags').select('id', 'name').where('id', tagId).first();
    return res.status(201).json(tag);
  }),
);

router.delete(
  '/:id/tags/:tagId',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    const tagId = Number(req.params.tagId);

    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    if (!Number.isInteger(tagId) || tagId <= 0) throw AppError.badRequest('Invalid tag id');

    const video = await knex('videos').where('id', videoId).first();
    if (!video) throw AppError.notFound('Video not found');

    await knex('video_tags').where({ video_id: videoId, tag_id: tagId }).del();
    return res.status(204).send();
  }),
);

router.put(
  '/:id/metadata',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { perf_date, group_name, artist_name, song_title, song_titles, event, camera_type } =
      req.body;

    const video = await knex('videos').where('id', id).first();
    if (!video) throw AppError.notFound('Video not found');

    const editableStatuses = ['new', 'needs_review', 'pending'];
    if (!editableStatuses.includes(video.status)) {
      throw AppError.badRequest(
        `Cannot edit metadata for video with status '${video.status}'. Only videos with status 'new', 'needs_review', or 'pending' can be edited.`,
      );
    }

    const updateData: Record<string, string | number | boolean | null> = {};

    if (perf_date !== undefined) {
      if (perf_date && !/^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(perf_date)) {
        throw AppError.badRequest(
          'Invalid perf_date format. Expected YYMMDD (e.g., 240315 for March 15, 2024)',
        );
      }
      updateData.perf_date = perf_date
        ? new Date(
            `20${perf_date.slice(0, 2)}-${perf_date.slice(2, 4)}-${perf_date.slice(4, 6)}`,
          ).toISOString()
        : null;
    }

    if (group_name !== undefined) updateData.group_name = group_name || null;
    if (artist_name !== undefined) updateData.artist_name = artist_name || null;

    let songSet: string[] | undefined;
    if (Array.isArray(song_titles)) {
      songSet = splitSongTitles(undefined, song_titles);
    } else if (song_title !== undefined) {
      songSet = splitSongTitles(song_title || undefined);
    }

    if (event !== undefined) {
      if (event && !event.startsWith('@')) {
        updateData.event = '@' + event.toUpperCase();
      } else {
        updateData.event = event || null;
      }
    }

    if (camera_type !== undefined) updateData.camera_type = camera_type || null;

    if (Object.keys(updateData).length === 0) return res.json(video);

    let newStatus = video.status;
    if (video.status === 'needs_review') {
      newStatus = 'new';
      updateData.status = newStatus;
    }
    updateData.updated_at = new Date().toISOString();

    const updatedVideo = await knex.transaction(async (trx) => {
      await trx('videos').where('id', id).update(updateData);
      if (songSet !== undefined) {
        await syncVideoSongs(Number(id), undefined, songSet, trx);
      }
      if (updateData.status && updateData.status !== video.status) {
        await trx('status_history').insert({
          video_id: id,
          old_status: video.status,
          new_status: updateData.status,
        });
      }
      const finalSongTitles =
        songSet ??
        (await getVideoSongsMap([Number(id)], trx)).get(Number(id))?.map((s) => s.title) ??
        [];
      const finalMetadata = {
        perf_date: updateData.perf_date ? perf_date : video.perf_date,
        group_name: updateData.group_name ?? video.group_name,
        artist_name: updateData.artist_name ?? video.artist_name,
        song_title: finalSongTitles.length ? finalSongTitles[finalSongTitles.length - 1] : null,
        song_titles: finalSongTitles,
        event: updateData.event ?? video.event,
        camera_type: updateData.camera_type ?? video.camera_type,
      };
      await trx('training_data').insert({
        video_id: id,
        original_title: video.original_title,
        final_metadata_json: JSON.stringify(finalMetadata),
      });
      return trx('videos').where('id', id).first();
    });

    const changedFields = Object.keys(updateData).filter(
      (key) => key !== 'updated_at' && key !== 'status',
    );
    await logEvent('metadata_updated', `Metadata updated for video ${video.youtube_id}`, {
      video_id: Number(id),
      youtube_id: video.youtube_id,
      changedFields,
      statusChanged: updateData.status ? { from: video.status, to: updateData.status } : null,
    });

    res.json(updatedVideo);
  }),
);

router.post(
  '/:id/parse',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const video = await knex('videos').where('id', id).first();
    if (!video) throw AppError.notFound('Video not found');

    const { metadata, needsReview } = await parseTitle(video.original_title);
    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);

    const updateData: Record<string, string | number | boolean | null> = {
      updated_at: new Date().toISOString(),
    };

    if (metadata.perf_date) {
      const dateStr = metadata.perf_date;
      updateData.perf_date = new Date(
        `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
      ).toISOString();
    }

    updateData.group_id = resolved.group_id;
    updateData.artist_id = resolved.artist_id;
    updateData.event_id = resolved.event_id;
    updateData.group_name = resolved.group_name;
    updateData.artist_name = resolved.artist_name;
    updateData.event = resolved.event;
    if (metadata.camera_type !== undefined) updateData.camera_type = metadata.camera_type || null;
    updateData.is_fancam = metadata.is_fancam ?? null;
    updateData.fancam_confidence = metadata.fancam_confidence ?? null;
    updateData.is_own_group_song = metadata.is_own_group_song ?? null;
    updateData.is_own_artist_song = metadata.is_own_artist_song ?? null;

    const newStatus = needsReview || forceReview ? 'needs_review' : 'new';
    updateData.status = newStatus;

    const updatedVideo = await knex.transaction(async (trx) => {
      await trx('videos').where('id', id).update(updateData);
      await syncVideoSongs(Number(id), resolved.song_title ?? undefined, metadata.song_titles, trx);
      await trx('status_history').insert({
        video_id: id,
        old_status: video.status,
        new_status: newStatus,
      });
      return trx('videos').where('id', id).first();
    });

    res.json({ video: updatedVideo, parsedMetadata: metadata, needsReview });
  }),
);

// Suppress unused import warnings
void paramsIdTagIdSchema;
void videoMetadataSchema;

export default router;
