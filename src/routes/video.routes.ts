import { Router, Request, Response } from 'express';
import knex from '../db';
import { parseTitle } from '../services/parser/parser.service';
import * as fs from 'fs';
import * as path from 'path';
import { youtubeService } from '../services/youtube.service';
import { logEvent } from '../services/eventLog.service';
import { assignAutoTags } from '../services/tag.service';

const router = Router();

type BatchValidationResult = { valid: true; videoIds: number[] } | { valid: false; error: string };
type TagValidationResult = { valid: true; tagName: string } | { valid: false; error: string };
const PROTECTED_TAGS = new Set(['short', 'private']);

function validateVideoIds(body: unknown): BatchValidationResult {
  const videoIds = (body as { videoIds?: unknown })?.videoIds;
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return { valid: false, error: 'videoIds must be a non-empty array of numbers' };
  }

  if (!videoIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    return { valid: false, error: 'videoIds must contain only positive integers' };
  }

  return { valid: true, videoIds };
}

function validateTagName(value: unknown): TagValidationResult {
  if (typeof value !== 'string') {
    return { valid: false, error: 'tagName must be a string' };
  }
  const tagName = value.trim();
  if (!tagName) {
    return { valid: false, error: 'tagName cannot be empty' };
  }
  if (tagName.length > 100) {
    return { valid: false, error: 'tagName must be 100 characters or less' };
  }
  return { valid: true, tagName };
}

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

function extractVideoIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  const directIdMatch = trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directIdMatch) {
    return directIdMatch[0];
  }

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * GET /api/videos - List all videos with filtering and pagination
 * Query params: status, page, limit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    let query = knex('videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select(
        'videos.id',
        'videos.youtube_id',
        'videos.channel_id',
        'videos.playlist_id',
        'videos.original_title',
        'videos.perf_date',
        'videos.group_name',
        'videos.artist_name',
        'videos.song_title',
        'videos.event',
        'videos.camera_type',
        'videos.duration_seconds',
        'videos.status',
        'videos.created_at',
        'videos.updated_at',
        'channels.title as channel_title',
        'playlists.title as playlist_title',
      );

    if (status) {
      query = query.where('videos.status', status);
    }

    if (process.env.HIDE_FLAGGED_VIDEOS === 'true') {
      query = query.whereNotIn('videos.id', function () {
        this.select('v2.id')
          .from('videos as v2')
          .join('video_tags as vt', 'vt.video_id', 'v2.id')
          .join('tags as t', 't.id', 'vt.tag_id')
          .whereIn('t.name', ['short', 'private']);
      });
    }

    query = query.orderBy('videos.created_at', 'desc');

    const videos = await query.limit(limit).offset(offset);
    const videoIds = videos.map((video) => video.id);
    const tagsByVideo = videoIds.length > 0 ? await getVideoTagsMap(videoIds) : new Map();
    const videosWithTags = videos.map((video) => ({
      ...video,
      tags: tagsByVideo.get(video.id) ?? [],
    }));

    const totalQuery = knex('videos');
    if (status) {
      totalQuery.where('status', status);
    }
    if (process.env.HIDE_FLAGGED_VIDEOS === 'true') {
      totalQuery.whereNotIn('videos.id', function () {
        this.select('v2.id')
          .from('videos as v2')
          .join('video_tags as vt', 'vt.video_id', 'v2.id')
          .join('tags as t', 't.id', 'vt.tag_id')
          .whereIn('t.name', ['short', 'private']);
      });
    }
    const total = await totalQuery.count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    res.json({
      videos: videosWithTags,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

router.post('/batch/confirm-download', async (req: Request, res: Response) => {
  const validation = validateVideoIds(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const errors: Array<{ videoId: number; error: string }> = [];
  let succeeded = 0;

  for (const videoId of validation.videoIds) {
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

      await logEvent('video_download_confirmed', `Download confirmed for video ${video.youtube_id}`, {
        video_id: videoId,
        youtube_id: video.youtube_id,
        file_path: filePath,
      });

      succeeded += 1;
    } catch (error) {
      console.error(`Error confirming download for video ${videoId}:`, error);
      errors.push({ videoId, error: 'Internal error while confirming download' });
    }
  }

  return res.json({
    processed: validation.videoIds.length,
    succeeded,
    failed: validation.videoIds.length - succeeded,
    errors,
  });
});

router.post('/batch/complete', async (req: Request, res: Response) => {
  const validation = validateVideoIds(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const errors: Array<{ videoId: number; error: string }> = [];
  let succeeded = 0;
  const allowedStatuses = ['thumbnails_generated', 'ready_for_upload'];

  for (const videoId of validation.videoIds) {
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

      if (fs.existsSync(downloadDir)) {
        fs.rmSync(downloadDir, { recursive: true, force: true });
      }
      if (fs.existsSync(previewDir)) {
        fs.rmSync(previewDir, { recursive: true, force: true });
      }

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
      console.error(`Error completing video ${videoId}:`, error);
      errors.push({ videoId, error: 'Internal error while completing video' });
    }
  }

  return res.json({
    processed: validation.videoIds.length,
    succeeded,
    failed: validation.videoIds.length - succeeded,
    errors,
  });
});

router.post('/batch/tags', async (req: Request, res: Response) => {
  const validation = validateVideoIds(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const tagValidation = validateTagName((req.body as { tagName?: unknown }).tagName);
  if (!tagValidation.valid) {
    return res.status(400).json({ error: tagValidation.error });
  }
  const { confirm } = req.body as { confirm?: boolean };
  if (isConfirmationRequired(tagValidation.tagName) && confirm !== true) {
    return res.status(400).json({
      error: `Adding "${tagValidation.tagName}" tag requires confirmation`,
      requiresConfirmation: true,
    });
  }

  try {
    const tagId = await findOrCreateTagId(tagValidation.tagName);
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of validation.videoIds) {
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
        console.error(`Error adding tag for video ${videoId}:`, error);
        errors.push({ videoId, error: 'Failed to add tag to video' });
      }
    }

    return res.json({
      processed: validation.videoIds.length,
      succeeded,
      failed: validation.videoIds.length - succeeded,
      errors,
    });
  } catch (error) {
    console.error('Error processing batch tag add:', error);
    return res.status(500).json({ error: 'Failed to process batch tag add' });
  }
});

router.delete('/batch/tags', async (req: Request, res: Response) => {
  const validation = validateVideoIds(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const tagValidation = validateTagName((req.body as { tagName?: unknown }).tagName);
  if (!tagValidation.valid) {
    return res.status(400).json({ error: tagValidation.error });
  }

  try {
    const tag = await knex('tags').whereRaw('LOWER(name) = LOWER(?)', [tagValidation.tagName]).first();
    if (!tag) {
      return res.json({
        processed: validation.videoIds.length,
        succeeded: validation.videoIds.length,
        failed: 0,
        errors: [],
      });
    }

    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of validation.videoIds) {
      try {
        const video = await knex('videos').where('id', videoId).first();
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }

        await knex('video_tags').where({ video_id: videoId, tag_id: tag.id }).del();
        succeeded += 1;
      } catch (error) {
        console.error(`Error removing tag for video ${videoId}:`, error);
        errors.push({ videoId, error: 'Failed to remove tag from video' });
      }
    }

    return res.json({
      processed: validation.videoIds.length,
      succeeded,
      failed: validation.videoIds.length - succeeded,
      errors,
    });
  } catch (error) {
    console.error('Error processing batch tag delete:', error);
    return res.status(500).json({ error: 'Failed to process batch tag delete' });
  }
});

/**
 * POST /api/videos/add - Add a single video by YouTube URL
 * Body: { url: string }
 */
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const videoId = extractVideoIdFromUrl(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube video URL' });
    }

    const existingVideo = await knex('videos').where('youtube_id', videoId).first();
    if (existingVideo) {
      return res.status(409).json({ error: 'Video already exists' });
    }

    const details = await youtubeService.getVideoDetails(videoId);
    const { metadata, needsReview } = await parseTitle(details.title, details.publishedAt, details.tags);

    const insertData: Record<string, any> = {
      youtube_id: videoId,
      original_title: details.title,
      url: url.trim(),
      published_at: details.publishedAt || null,
      status: needsReview ? 'needs_review' : 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (metadata.perf_date) {
      const dateStr = metadata.perf_date;
      insertData.perf_date = new Date(
        `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
      ).toISOString();
    }
    if (metadata.group_name !== undefined) insertData.group_name = metadata.group_name || null;
    if (metadata.artist_name !== undefined) insertData.artist_name = metadata.artist_name || null;
    if (metadata.song_title !== undefined) insertData.song_title = metadata.song_title || null;
    if (metadata.event !== undefined) insertData.event = metadata.event || null;
    if (metadata.camera_type !== undefined) insertData.camera_type = metadata.camera_type || null;

    const [createdVideo] = await knex('videos').insert(insertData).returning('*');
    await assignAutoTags(createdVideo.id, details.durationSeconds, details.privacyStatus);

    await logEvent('video_added_manual', `Manual video added: ${createdVideo.original_title}`, {
      video_id: createdVideo.id,
      youtube_id: createdVideo.youtube_id,
      status: createdVideo.status,
    });

    return res.status(201).json(createdVideo);
  } catch (error: any) {
    console.error('Error adding manual video:', error);

    if (error?.message?.includes('Video not found')) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (error?.code === 'SQLITE_CONSTRAINT' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Video already exists' });
    }

    return res.status(500).json({ error: 'Failed to add video' });
  }
});

/**
 * GET /api/videos/:id - Get single video details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const video = await knex('videos')
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

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const tags = await knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('tags.id', 'tags.name')
      .where('video_tags.video_id', video.id)
      .orderBy('tags.name', 'asc');

    res.json({
      ...video,
      tags,
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

router.get('/:id/tags', async (req: Request, res: Response) => {
  const videoId = Number(req.params.id);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    return res.status(400).json({ error: 'Invalid video id' });
  }

  try {
    const video = await knex('videos').where('id', videoId).first();
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const tags = await knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('tags.id', 'tags.name')
      .where('video_tags.video_id', videoId)
      .orderBy('tags.name', 'asc');

    return res.json(tags);
  } catch (error) {
    console.error(`Error fetching tags for video ${videoId}:`, error);
    return res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.post('/:id/tags', async (req: Request, res: Response) => {
  const videoId = Number(req.params.id);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    return res.status(400).json({ error: 'Invalid video id' });
  }

  const tagValidation = validateTagName((req.body as { name?: unknown }).name);
  if (!tagValidation.valid) {
    return res.status(400).json({ error: tagValidation.error.replace('tagName', 'name') });
  }
  const { confirm } = req.body as { confirm?: boolean };
  if (isConfirmationRequired(tagValidation.tagName) && confirm !== true) {
    return res.status(400).json({
      error: `Adding "${tagValidation.tagName}" tag requires confirmation`,
      requiresConfirmation: true,
    });
  }

  try {
    const video = await knex('videos').where('id', videoId).first();
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const tagId = await findOrCreateTagId(tagValidation.tagName);
    await knex('video_tags').insert({ video_id: videoId, tag_id: tagId }).onConflict(['video_id', 'tag_id']).ignore();

    const tag = await knex('tags').select('id', 'name').where('id', tagId).first();
    return res.status(201).json(tag);
  } catch (error) {
    console.error(`Error adding tag to video ${videoId}:`, error);
    return res.status(500).json({ error: 'Failed to add tag' });
  }
});

router.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  const videoId = Number(req.params.id);
  const tagId = Number(req.params.tagId);

  if (!Number.isInteger(videoId) || videoId <= 0) {
    return res.status(400).json({ error: 'Invalid video id' });
  }
  if (!Number.isInteger(tagId) || tagId <= 0) {
    return res.status(400).json({ error: 'Invalid tag id' });
  }

  try {
    const video = await knex('videos').where('id', videoId).first();
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await knex('video_tags').where({ video_id: videoId, tag_id: tagId }).del();
    return res.status(204).send();
  } catch (error) {
    console.error(`Error removing tag ${tagId} from video ${videoId}:`, error);
    return res.status(500).json({ error: 'Failed to remove tag' });
  }
});

/**
 * PUT /api/videos/:id/metadata - Update video metadata manually
 *
 * This endpoint allows manual editing of parsed metadata fields.
 * It validates the video exists and is in an editable state.
 */
router.put('/:id/metadata', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { perf_date, group_name, artist_name, song_title, event, camera_type } = req.body;

    // Find the video
    const video = await knex('videos').where('id', id).first();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if video is in an editable state
    const editableStatuses = ['new', 'needs_review', 'pending'];
    if (!editableStatuses.includes(video.status)) {
      return res.status(400).json({
        error: `Cannot edit metadata for video with status '${video.status}'. Only videos with status 'new', 'needs_review', or 'pending' can be edited.`,
      });
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};

    if (perf_date !== undefined) {
      // Validate perf_date format (YYMMDD)
      if (perf_date && !/^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(perf_date)) {
        return res.status(400).json({
          error: 'Invalid perf_date format. Expected YYMMDD (e.g., 240315 for March 15, 2024)',
        });
      }
      updateData.perf_date = perf_date
        ? new Date(
            `20${perf_date.slice(0, 2)}-${perf_date.slice(2, 4)}-${perf_date.slice(4, 6)}`,
          ).toISOString()
        : null;
    }

    if (group_name !== undefined) {
      updateData.group_name = group_name || null;
    }

    if (artist_name !== undefined) {
      updateData.artist_name = artist_name || null;
    }

    if (song_title !== undefined) {
      updateData.song_title = song_title || null;
    }

    if (event !== undefined) {
      // Ensure @ prefix for events
      if (event && !event.startsWith('@')) {
        updateData.event = '@' + event.toUpperCase();
      } else {
        updateData.event = event || null;
      }
    }

    if (camera_type !== undefined) {
      updateData.camera_type = camera_type || null;
    }

    // If no fields to update, return current video
    if (Object.keys(updateData).length === 0) {
      return res.json(video);
    }

    // Determine new status
    let newStatus = video.status;
    if (video.status === 'needs_review') {
      // If editing from needs_review, set to 'new' (ready for processing)
      newStatus = 'new';
      updateData.status = newStatus;
    }

    // Update timestamp
    updateData.updated_at = new Date().toISOString();

    // Perform the update in a transaction
    const updatedVideo = await knex.transaction(async (trx) => {
      // Update the video
      await trx('videos').where('id', id).update(updateData);

      // Record status change if status was updated
      if (updateData.status && updateData.status !== video.status) {
        await trx('status_history').insert({
          video_id: id,
          old_status: video.status,
          new_status: updateData.status,
        });
      }

      // Insert training data record with the final metadata
      const finalMetadata = {
        perf_date: updateData.perf_date ? perf_date : video.perf_date,
        group_name: updateData.group_name ?? video.group_name,
        artist_name: updateData.artist_name ?? video.artist_name,
        song_title: updateData.song_title ?? video.song_title,
        event: updateData.event ?? video.event,
        camera_type: updateData.camera_type ?? video.camera_type,
      };

      await trx('training_data').insert({
        video_id: id,
        original_title: video.original_title,
        final_metadata_json: JSON.stringify(finalMetadata),
      });

      // Fetch and return the updated video
      const updated = await trx('videos').where('id', id).first();
      return updated;
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
  } catch (error) {
    console.error('Error updating video metadata:', error);
    res.status(500).json({ error: 'Failed to update video metadata' });
  }
});

/**
 * POST /api/videos/:id/parse - Re-parse video title
 *
 * This endpoint re-runs the parser on the original title.
 * Useful when the parser logic has been updated.
 */
router.post('/:id/parse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find the video
    const video = await knex('videos').where('id', id).first();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Re-parse the title
    const { metadata, needsReview } = await parseTitle(video.original_title);

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (metadata.perf_date) {
      // Convert YYMMDD to proper date
      const dateStr = metadata.perf_date;
      updateData.perf_date = new Date(
        `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
      ).toISOString();
    }

    if (metadata.group_name !== undefined) {
      updateData.group_name = metadata.group_name || null;
    }

    if (metadata.artist_name !== undefined) {
      updateData.artist_name = metadata.artist_name || null;
    }

    if (metadata.song_title !== undefined) {
      updateData.song_title = metadata.song_title || null;
    }

    if (metadata.event !== undefined) {
      updateData.event = metadata.event || null;
    }

    if (metadata.camera_type !== undefined) {
      updateData.camera_type = metadata.camera_type || null;
    }

    // Set status based on parsing result
    const newStatus = needsReview ? 'needs_review' : 'new';
    updateData.status = newStatus;

    // Perform the update
    const updatedVideo = await knex.transaction(async (trx) => {
      // Update the video
      await trx('videos').where('id', id).update(updateData);

      // Record status change
      await trx('status_history').insert({
        video_id: id,
        old_status: video.status,
        new_status: newStatus,
      });

      // Fetch and return the updated video
      const updated = await trx('videos').where('id', id).first();
      return updated;
    });

    res.json({
      video: updatedVideo,
      parsedMetadata: metadata,
      needsReview,
    });
  } catch (error) {
    console.error('Error re-parsing video title:', error);
    res.status(500).json({ error: 'Failed to re-parse video title' });
  }
});

export default router;
