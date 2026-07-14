import * as fs from 'fs';
import * as path from 'path';
import { youtubeService } from './youtube.service';
import { parseTitle } from './parser/parser.service';
import { resolveParsedMetadata, hasUnresolvedEntity } from './parser/metadataResolver.service';
import { parseTitleWithLLM } from './ai.service';
import { syncVideoSongs, getVideoSongsMap } from './parser/videoSongs.service';
import { splitSongTitles } from './parser/songTitles.util';
import { assignAutoTags } from './tag.service';
import { logEvent } from './eventLog.service';
import { AppError } from '../middleware/AppError';
import { videoRepository, tagRepository, channelRepository, fileRepository } from '@vidpulse/db';
import type { IVideoFilters, VideoEntity } from '@vidpulse/db';
import { VALID_STATUSES, isValidStatus } from '../models/videoStatus';
import { config } from '../config';
import { escapeShellValueForDoubleQuotes, renderTemplate } from './template/template.engine';
import { buildVideoContext } from './template/videoContext';

export interface VideoListItem {
  id: number;
  youtube_id: string;
  channel_id: number;
  playlist_id?: number | null;
  original_title: string;
  description?: string | null;
  perf_date?: string | null;
  group_name?: string | null;
  artist_name?: string | null;
  event?: string | null;
  camera_type?: string | null;
  duration_seconds?: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  channel_title?: string | null;
  playlist_title?: string | null;
  tags: Array<{ id: number; name: string }>;
  songs: Array<{ title: string }>;
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ videoId: number; error: string }>;
}

function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  return (
    trimmed.match(/^[a-zA-Z0-9_-]{11}$/)?.[0] ??
    trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1] ??
    trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1] ??
    trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)?.[1] ??
    trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ??
    null
  );
}

function parsePerfDate(dateStr: string): string {
  return new Date(
    `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
  ).toISOString();
}

class VideoService {
  async getVideos(
    filters: IVideoFilters & { status?: string },
    pagination: { page: number; limit: number; offset: number },
  ): Promise<{
    videos: VideoListItem[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const { status, ...rest } = filters;
    if (status && !isValidStatus(status)) {
      throw AppError.badRequest(
        `Invalid status '${status}'. Allowed: ${VALID_STATUSES.join(', ')}`,
      );
    }

    const videos = await videoRepository.findAllDisplay(
      { ...rest, status },
      { limit: pagination.limit, offset: pagination.offset },
    );

    const videoIds = videos.map((v) => v.id);
    const tagsByVideo =
      videoIds.length > 0 ? await tagRepository.getVideosTagsMap(videoIds) : new Map();
    const songsByVideo = videoIds.length > 0 ? await getVideoSongsMap(videoIds) : new Map();
    const totalCount = await videoRepository.countAll({ ...rest, status });

    const items: VideoListItem[] = videos.map((video) => ({
      id: video.id,
      youtube_id: video.youtube_id,
      channel_id: video.channel_id,
      playlist_id: video.playlist_id,
      original_title: video.original_title,
      description: video.description,
      perf_date: video.perf_date,
      group_name: video.group_name,
      artist_name: video.artist_name,
      event: video.event,
      camera_type: video.camera_type,
      duration_seconds: video.duration_seconds,
      status: video.status,
      created_at: video.created_at,
      updated_at: video.updated_at,
      channel_title: (video as any).channel_title ?? null,
      playlist_title: (video as any).playlist_title ?? null,
      tags: tagsByVideo.get(video.id) ?? [],
      songs: songsByVideo.get(video.id) ?? [],
    }));

    return {
      videos: items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: totalCount,
      },
    };
  }

  async getVideoById(id: number): Promise<
    VideoEntity & {
      tags: Array<{ id: number; name: string }>;
      songs: Array<{ title: string }>;
      file_width: number | null;
      file_height: number | null;
    }
  > {
    const video = await videoRepository.findByIdDisplay(id);
    if (!video) throw AppError.notFound('Video not found');
    const tags = await tagRepository.getVideoTags(id);
    const songs = (await getVideoSongsMap([id])).get(id) ?? [];
    const dims = (await fileRepository.getDimensionsByVideoIds([id])).get(id);
    return {
      ...video,
      tags,
      songs,
      file_width: dims?.width ?? null,
      file_height: dims?.height ?? null,
    };
  }

  async addVideo(url: string): Promise<VideoEntity> {
    const videoId = extractYoutubeId(url);
    if (!videoId) throw AppError.badRequest('Invalid YouTube video URL');

    const existing = await videoRepository.findByYoutubeId(videoId);
    if (existing) {
      throw new AppError(409, 'Video already exists', 'CONFLICT');
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

    const { metadata } = await parseTitle(
      details.title,
      details.publishedAt,
      details.tags,
      details.description,
    );
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
      group_id: resolved.group_id,
      artist_id: resolved.artist_id,
      event_id: resolved.event_id,
      group_name: resolved.group_name,
      artist_name: resolved.artist_name,
      event: resolved.event,
      is_fancam: metadata.is_fancam ?? null,
      fancam_confidence: metadata.fancam_confidence ?? null,
      is_own_group_song: metadata.is_own_group_song ?? null,
      is_own_artist_song: metadata.is_own_artist_song ?? null,
    };

    if (metadata.perf_date) {
      insertData.perf_date = parsePerfDate(metadata.perf_date);
    }
    if (metadata.camera_type !== undefined) {
      insertData.camera_type = metadata.camera_type || null;
    }

    const newId = await videoRepository.insert(insertData as any);
    const created = await videoRepository.findById(newId);
    if (!created) throw AppError.internal('Failed to create video');

    await syncVideoSongs(created.id, resolved.song_title ?? undefined, metadata.song_titles);
    await assignAutoTags(created.id, details.durationSeconds, details.privacyStatus);
    await logEvent('video_added_manual', `Manual video added: ${created.original_title}`, {
      video_id: created.id,
      youtube_id: created.youtube_id,
      status: created.status,
    });

    return created;
  }

  async updateMetadata(
    id: number,
    body: {
      perf_date?: string;
      group_name?: string;
      artist_name?: string;
      song_title?: string;
      song_titles?: string[];
      event?: string;
      camera_type?: string;
    },
  ): Promise<VideoEntity> {
    const video = await videoRepository.findById(id);
    if (!video) throw AppError.notFound('Video not found');

    const editableStatuses = ['new', 'needs_review', 'pending'];
    if (!editableStatuses.includes(video.status)) {
      throw AppError.badRequest(
        `Cannot edit metadata for video with status '${video.status}'. Only videos with status 'new', 'needs_review', or 'pending' can be edited.`,
      );
    }

    const updateData: Record<string, string | number | boolean | null> = {};

    if (body.perf_date !== undefined) {
      if (body.perf_date && !/^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(body.perf_date)) {
        throw AppError.badRequest(
          'Invalid perf_date format. Expected YYMMDD (e.g., 240315 for March 15, 2024)',
        );
      }
      updateData.perf_date = body.perf_date ? parsePerfDate(body.perf_date) : null;
    }

    if (body.group_name !== undefined) updateData.group_name = body.group_name || null;
    if (body.artist_name !== undefined) updateData.artist_name = body.artist_name || null;

    let songSet: string[] | undefined;
    if (Array.isArray(body.song_titles)) {
      songSet = splitSongTitles(undefined, body.song_titles);
    } else if (body.song_title !== undefined) {
      songSet = splitSongTitles(body.song_title || undefined);
    }

    if (body.event !== undefined) {
      if (body.event && !body.event.startsWith('@')) {
        updateData.event = '@' + body.event.toUpperCase();
      } else {
        updateData.event = body.event || null;
      }
    }

    if (body.camera_type !== undefined) updateData.camera_type = body.camera_type || null;

    // Song edits live in video_songs (synced inside the transaction below), not in updateData —
    // a songs-only request must not take the "nothing changed" early return.
    if (Object.keys(updateData).length === 0 && songSet === undefined) return video;

    let newStatus = video.status;
    if (video.status === 'needs_review') {
      newStatus = 'new';
      updateData.status = newStatus;
    }
    updateData.updated_at = new Date().toISOString();

    const { knex } = await import('@vidpulse/db');
    await knex.transaction(async (trx) => {
      await trx('videos').where('id', id).update(updateData);
      if (songSet !== undefined) {
        await syncVideoSongs(id, undefined, songSet, trx);
      }
      if (updateData.status && updateData.status !== video.status) {
        await trx('status_history').insert({
          video_id: id,
          old_status: video.status,
          new_status: updateData.status,
        });
      }
      const finalSongTitles =
        songSet ?? (await getVideoSongsMap([id], trx)).get(id)?.map((s: any) => s.title) ?? [];
      const finalMetadata = {
        perf_date: updateData.perf_date ? body.perf_date : video.perf_date,
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
    });

    const changedFields = Object.keys(updateData).filter(
      (key) => key !== 'updated_at' && key !== 'status',
    );
    await logEvent('metadata_updated', `Metadata updated for video ${video.youtube_id}`, {
      video_id: id,
      youtube_id: video.youtube_id,
      changedFields,
      statusChanged: updateData.status ? { from: video.status, to: updateData.status } : null,
    });

    const updated = await videoRepository.findById(id);
    return updated!;
  }

  async ignoreVideo(id: number): Promise<VideoEntity> {
    const video = await videoRepository.findById(id);
    if (!video) throw AppError.notFound('Video not found');
    if (video.status === 'completed') {
      throw AppError.badRequest("Cannot ignore videos with status 'completed'");
    }
    if (video.status !== 'ignored') {
      const { knex } = await import('@vidpulse/db');
      await knex.transaction(async (trx) => {
        await trx('videos').where('id', id).update({
          status: 'ignored',
          updated_at: new Date().toISOString(),
        });
        await trx('status_history').insert({
          video_id: id,
          old_status: video.status,
          new_status: 'ignored',
        });
      });
    }
    const updated = await videoRepository.findById(id);
    return updated!;
  }

  async batchConfirmDownload(videoIds: number[]): Promise<BatchResult> {
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;
    const { knex } = await import('@vidpulse/db');

    for (const videoId of videoIds) {
      try {
        const video = await videoRepository.findById(videoId);
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
        errors.push({ videoId, error: 'Internal error while confirming download' });
      }
    }
    return { processed: videoIds.length, succeeded, failed: videoIds.length - succeeded, errors };
  }

  async batchComplete(videoIds: number[]): Promise<BatchResult> {
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;
    const allowedStatuses = ['thumbnails_generated', 'ready_for_upload'];
    const { knex } = await import('@vidpulse/db');

    for (const videoId of videoIds) {
      try {
        const video = await videoRepository.findById(videoId);
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
          await trx('videos')
            .where('id', videoId)
            .update({ status: 'completed', updated_at: new Date().toISOString() });
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
        errors.push({ videoId, error: 'Internal error while completing video' });
      }
    }
    return { processed: videoIds.length, succeeded, failed: videoIds.length - succeeded, errors };
  }

  async batchIgnore(videoIds: number[]): Promise<BatchResult> {
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;
    const { knex } = await import('@vidpulse/db');

    for (const videoId of videoIds) {
      try {
        const video = await videoRepository.findById(videoId);
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
          await trx('videos')
            .where('id', videoId)
            .update({ status: 'ignored', updated_at: new Date().toISOString() });
          await trx('status_history').insert({
            video_id: videoId,
            old_status: video.status,
            new_status: 'ignored',
          });
        });
        succeeded += 1;
      } catch (error) {
        errors.push({ videoId, error: 'Internal error while ignoring video' });
      }
    }
    return { processed: videoIds.length, succeeded, failed: videoIds.length - succeeded, errors };
  }

  async batchAddTags(videoIds: number[], tagName: string, confirm?: boolean): Promise<BatchResult> {
    if (tagRepository.isProtected(tagName) && confirm !== true) {
      throw Object.assign(AppError.badRequest(`Adding "${tagName}" tag requires confirmation`), {
        requiresConfirmation: true,
      });
    }
    const tagId = await tagRepository.findOrCreate(tagName);
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of videoIds) {
      try {
        const video = await videoRepository.findById(videoId);
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        await tagRepository.addVideoTag(videoId, tagId);
        succeeded += 1;
      } catch {
        errors.push({ videoId, error: 'Failed to add tag to video' });
      }
    }
    return { processed: videoIds.length, succeeded, failed: videoIds.length - succeeded, errors };
  }

  async batchRemoveTags(videoIds: number[], tagName: string): Promise<BatchResult> {
    const tag = await tagRepository.findByName(tagName);
    if (!tag) {
      return { processed: videoIds.length, succeeded: videoIds.length, failed: 0, errors: [] };
    }
    const errors: Array<{ videoId: number; error: string }> = [];
    let succeeded = 0;

    for (const videoId of videoIds) {
      try {
        const video = await videoRepository.findById(videoId);
        if (!video) {
          errors.push({ videoId, error: 'Video not found' });
          continue;
        }
        await tagRepository.removeVideoTag(videoId, tag.id);
        succeeded += 1;
      } catch {
        errors.push({ videoId, error: 'Failed to remove tag from video' });
      }
    }
    return { processed: videoIds.length, succeeded, failed: videoIds.length - succeeded, errors };
  }

  async getVideoTags(videoId: number): Promise<Array<{ id: number; name: string }>> {
    const video = await videoRepository.findById(videoId);
    if (!video) throw AppError.notFound('Video not found');
    return tagRepository.getVideoTags(videoId);
  }

  async addVideoTag(
    videoId: number,
    tagName: string,
    confirm?: boolean,
  ): Promise<{ id: number; name: string }> {
    if (tagRepository.isProtected(tagName) && confirm !== true) {
      throw Object.assign(AppError.badRequest(`Adding "${tagName}" tag requires confirmation`), {
        requiresConfirmation: true,
      });
    }
    const video = await videoRepository.findById(videoId);
    if (!video) throw AppError.notFound('Video not found');
    const tagId = await tagRepository.findOrCreate(tagName);
    await tagRepository.addVideoTag(videoId, tagId);
    return { id: tagId, name: tagName };
  }

  async removeVideoTag(videoId: number, tagId: number): Promise<void> {
    const video = await videoRepository.findById(videoId);
    if (!video) throw AppError.notFound('Video not found');
    await tagRepository.removeVideoTag(videoId, tagId);
  }

  async suggestMetadata(videoId: number): Promise<unknown> {
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    const video = await videoRepository.findById(videoId);
    if (!video) throw AppError.notFound('Video not found');
    try {
      return await parseTitleWithLLM(video.original_title, video.description ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI suggestion failed';
      throw new AppError(502, `AI suggestion failed: ${message}`);
    }
  }

  async resyncVideo(videoId: number): Promise<{
    video: VideoEntity & { tags: Array<{ id: number; name: string }> };
    resyncLog: unknown;
  }> {
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    const existingVideo = await videoRepository.findById(videoId);
    if (!existingVideo) throw AppError.notFound('Video not found');

    const resyncLog: Record<string, unknown> = { parseLog: { input: { title: '' } } };

    let details;
    try {
      details = await youtubeService.getVideoDetails(existingVideo.youtube_id);
    } catch (error) {
      await videoRepository.update(videoId, {
        status: 'error',
        updated_at: new Date().toISOString(),
      });
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
    resyncLog.parseLog = {
      input: {
        title: details.title,
        publishedAt: details.publishedAt,
        tags: details.tags,
        description: details.description,
      },
    };

    let metadata: any, needsReview: boolean | undefined;
    try {
      const parseResult = await parseTitle(
        details.title,
        details.publishedAt,
        details.tags,
        details.description,
      );
      metadata = parseResult.metadata;
      needsReview = parseResult.needsReview;
      resyncLog.parseLog = {
        ...(resyncLog.parseLog as Record<string, unknown>),
        output: parseResult,
      };
    } catch (error) {
      resyncLog.parseLog = {
        ...(resyncLog.parseLog as Record<string, unknown>),
        error: error instanceof Error ? error.message : 'Unknown parser error',
      };
      throw AppError.internal('Failed to parse fresh metadata');
    }

    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);

    const { knex } = await import('@vidpulse/db');
    const updatedVideo = await knex.transaction(async (trx: any) => {
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
        .whereIn('name', ['shorts', 'short', 'private', 'длинное видео']);
      if (autoTagIds.length > 0) {
        await trx('video_tags')
          .where('video_id', videoId)
          .whereIn(
            'tag_id',
            autoTagIds.map((t: any) => t.id),
          )
          .del();
      }
      await assignAutoTags(videoId, details.durationSeconds, details.privacyStatus, trx);

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
    const tags = await tagRepository.getVideoTags(videoId);
    return { video: { ...updatedVideo, tags }, resyncLog };
  }

  async reparseVideo(
    videoId: number,
  ): Promise<{ video: VideoEntity; parsedMetadata: unknown; needsReview: boolean | undefined }> {
    const video = await videoRepository.findById(videoId);
    if (!video) throw AppError.notFound('Video not found');

    const { metadata, needsReview } = await parseTitle(video.original_title);
    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);

    const updateData: Record<string, string | number | boolean | null> = {
      updated_at: new Date().toISOString(),
    };

    if (metadata.perf_date) updateData.perf_date = parsePerfDate(metadata.perf_date);
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

    const { knex } = await import('@vidpulse/db');
    await knex.transaction(async (trx: any) => {
      await trx('videos').where('id', videoId).update(updateData);
      await syncVideoSongs(videoId, resolved.song_title ?? undefined, metadata.song_titles, trx);
      await trx('status_history').insert({
        video_id: videoId,
        old_status: video.status,
        new_status: newStatus,
      });
    });

    const updated = await videoRepository.findById(videoId);
    return { video: updated!, parsedMetadata: metadata, needsReview };
  }

  /**
   * Render the SHELL_COMMAND_VIDEO template for the given videos into a single shell command.
   * The template may iterate the selection with {{#each video}}…{{/each}} (one command for the
   * whole selection, e.g. `mv "url1" "url2" /dest/`) or address a single video directly.
   */
  async buildFileCommand(videoIds: number[]): Promise<{ command: string }> {
    const template = config.files.shellCommand;
    if (!template) {
      throw AppError.badRequest('SHELL_COMMAND_VIDEO is not configured');
    }

    const videoContexts = [];
    for (const videoId of videoIds) {
      const video = await this.getVideoById(videoId);
      videoContexts.push(buildVideoContext(video));
    }

    // Substituted values are YouTube-controlled (titles, events, song names) — escape them for
    // a double-quoted shell context so a crafted title can't inject into the generated command.
    return {
      command: renderTemplate(
        template,
        { video: videoContexts },
        { transformValue: escapeShellValueForDoubleQuotes },
      ),
    };
  }

  /**
   * Move each video's linked file(s) from their current location into FILES_OUTPUT_DIR,
   * renaming them with the RENAME_TEMPLATE_VIDEO new-name template (the source extension is
   * preserved; `/` in the rendered name is replaced with `-`). Videos without a linked file
   * are skipped. Each video (and each of its files) is processed independently — a failure
   * looking up one video, or a destination filename collision, is recorded in `errors` without
   * aborting the rest of the batch.
   */
  async renameFiles(
    videoIds: number[],
  ): Promise<{ moved: number; skipped: number; errors: string[] }> {
    const template = config.files.renameTemplate;
    if (!template) {
      throw AppError.badRequest('RENAME_TEMPLATE_VIDEO is not configured');
    }
    const outputDir = config.files.outputDir;
    if (!outputDir) {
      throw AppError.badRequest('FILES_OUTPUT_DIR is not configured');
    }

    let moved = 0;
    let skipped = 0;
    const errors: string[] = [];
    // Destinations already claimed during this run, so two files that render to the same name
    // don't silently clobber each other (fs.rename overwrites an existing destination with no error).
    const claimedDestPaths = new Set<string>();

    for (const videoId of videoIds) {
      try {
        const video = await this.getVideoById(videoId);
        const { files } = await fileRepository.getAll({ videoId, limit: 1000 });
        if (files.length === 0) {
          skipped++;
          continue;
        }

        const baseName = renderTemplate(template, { video: [buildVideoContext(video)] })
          .replace(/\//g, '-')
          .trim();

        for (const file of files) {
          const newFilename = baseName + (file.extension ?? '');
          const sourcePath = path.join(file.directory, file.filename);
          const destPath = path.join(outputDir, newFilename);
          try {
            if (destPath === sourcePath) {
              moved++; // already at the correct location
              continue;
            }
            if (claimedDestPaths.has(destPath) || fs.existsSync(destPath)) {
              throw new Error(`destination already exists: ${newFilename}`);
            }
            await fs.promises.mkdir(outputDir, { recursive: true });
            await fs.promises.rename(sourcePath, destPath);
            await fileRepository.updatePath(file.id, outputDir, newFilename);
            claimedDestPaths.add(destPath);
            moved++;
          } catch (err) {
            errors.push(`${file.filename}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`video ${videoId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { moved, skipped, errors };
  }
}

export const videoService = new VideoService();
