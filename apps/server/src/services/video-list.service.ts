import { knex } from '@vidpulse/db';
import { videoListRepository, fileRepository } from '@vidpulse/db';
import { videoService } from './video.service';
import { parserService } from './parser.service';
import { AppError } from '../middleware/AppError';
import { config } from '../config';
import { buildPaginationMeta } from '../routes/pagination';
import { renderTemplate } from './template/template.engine';
import { buildVideoContext } from './template/videoContext';
import { getVideoSongsMap } from './videoSongs.service';

const COLORS = [
  'magenta',
  'red',
  'volcano',
  'orange',
  'gold',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
];
const MAX_VIDEO_LIST_ITEMS = config.maxVideoListItems;

// Operations that move every video in the list through the pipeline as a unit.
// Status-changing ops are applied to the whole list so it stays homogeneous.
const STATUS_OPERATIONS = ['confirmDownload', 'complete', 'ignore'] as const;
const TAG_OPERATIONS = ['addTag', 'removeTag'] as const;

class VideoListService {
  async create(name: string, videoIds?: number[]) {
    const ids = videoIds ?? [];
    if (ids.length > MAX_VIDEO_LIST_ITEMS) {
      throw new AppError(409, 'Video list limit exceeded', 'CONFLICT');
    }

    const status = await this.ensureVideosCanBeAssigned(ids);

    const allLists = await videoListRepository.findAll();
    const usedColors = allLists.map((l) => l.color);
    const color = COLORS.find((c) => !usedColors.includes(c)) || `custom-${Date.now()}`;

    const listId = await videoListRepository.create({ name, color, status });
    const created = await videoListRepository.findById(listId);

    if (ids.length > 0) {
      await knex('videos')
        .whereIn('id', ids)
        .update({ video_list_id: listId, updated_at: new Date().toISOString() });
    }

    return { ...created, countVideos: ids.length };
  }

  async getAll() {
    const lists = await knex('video_lists as l')
      .leftJoin('videos as v', 'v.video_list_id', 'l.id')
      .groupBy('l.id')
      .select('l.id', 'l.name', 'l.color', 'l.status')
      .count<{ countVideos: number }>('v.id as countVideos');
    return lists;
  }

  /**
   * `duplicatesOnly` and pagination both need to see the whole list first: duplicate detection
   * has to compare every video's predicted filename before anything is sliced into a page, and
   * `duplicatesOnly` narrows that full set before paginating it. Lists are capped at
   * MAX_VIDEO_LIST_ITEMS, so fetching everything and paginating in memory is cheap.
   */
  async getById(
    id: number,
    options?: {
      page?: number;
      limit?: number;
      duplicatesOnly?: boolean;
      predictedFilename?: string;
    },
  ) {
    const list = await videoListRepository.findById(id);
    if (!list) throw AppError.notFound('List not found');

    const { videos: videoMap } = await videoListRepository.findWithVideos(id);
    const rawVideos = Array.from(videoMap.values());
    const allVideoIds = rawVideos.map((v) => v.id);

    const template = config.files.renameTemplate;
    const songsByVideo = template
      ? await getVideoSongsMap(rawVideos.map((v) => v.id))
      : new Map<number, Array<{ id: number | null; title: string }>>();
    const dimensionsByVideo = template
      ? await fileRepository.getDimensionsByVideoIds(rawVideos.map((v) => v.id))
      : new Map<number, { width: number | null; height: number | null }>();

    const withPredictedNames = rawVideos.map((v) => {
      let predicted_filename: string | null = null;
      if (template) {
        const context = buildVideoContext({
          youtube_id: v.youtube_id,
          original_title: v.title,
          group_name: v.group,
          artist_name: v.artist,
          perf_date: v.perf_date,
          event: v.event,
          camera_type: v.camera_type,
          channel_title: v.channel_title,
          playlist_title: v.playlist_title,
          duration_seconds: v.duration,
          status: v.status,
          songs: (songsByVideo.get(v.id) ?? []).map((s) => ({ title: s.title })),
          tags: v.tags.map((name) => ({ name })),
          file_width: dimensionsByVideo.get(v.id)?.width ?? null,
          file_height: dimensionsByVideo.get(v.id)?.height ?? null,
        } as unknown as Parameters<typeof buildVideoContext>[0]);
        const rendered = renderTemplate(template, { video: [context] })
          .replace(/\//g, '-')
          .trim();
        predicted_filename = rendered || null;
      }
      return { ...v, predicted_filename };
    });

    const nameCounts = new Map<string, number>();
    for (const v of withPredictedNames) {
      if (!v.predicted_filename) continue;
      nameCounts.set(v.predicted_filename, (nameCounts.get(v.predicted_filename) ?? 0) + 1);
    }
    const withDuplicateFlag = withPredictedNames.map((v) => ({
      ...v,
      has_duplicate_name:
        Boolean(v.predicted_filename) && (nameCounts.get(v.predicted_filename!) ?? 0) > 1,
    }));

    let filtered = options?.duplicatesOnly
      ? withDuplicateFlag.filter((v) => v.has_duplicate_name)
      : withDuplicateFlag;
    if (options?.predictedFilename) {
      filtered = filtered.filter((v) => v.predicted_filename === options.predictedFilename);
    }

    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, options?.limit ?? 20);
    const offset = (page - 1) * limit;
    // Project to the public VideoListVideo shape — drop the template-only fields
    // (perf_date/event/camera_type/channel_title/playlist_title) that predicted_filename needed.
    const pageSlice = filtered.slice(offset, offset + limit).map((v) => ({
      id: v.id,
      youtube_id: v.youtube_id,
      title: v.title,
      artist: v.artist,
      group: v.group,
      duration: v.duration,
      status: v.status,
      has_file: v.has_file,
      tags: v.tags,
      predicted_filename: v.predicted_filename,
      has_duplicate_name: v.has_duplicate_name,
    }));

    return {
      ...list,
      videos: pageSlice,
      pagination: buildPaginationMeta(page, limit, filtered.length),
      allVideoIds,
    };
  }

  async addVideos(listId: number, videoIds: number[]) {
    const list = await videoListRepository.findById(listId);
    if (!list) throw AppError.notFound('List not found');

    const currentCount = await videoListRepository.videoCount(listId);
    if (currentCount + videoIds.length > MAX_VIDEO_LIST_ITEMS) {
      throw new AppError(409, 'Video list limit exceeded', 'CONFLICT');
    }

    // New videos must share the list's status (or, for an empty list, be homogeneous).
    await this.ensureVideosCanBeAssigned(videoIds, listId, list.status);

    await knex('videos')
      .whereIn('id', videoIds)
      .update({ video_list_id: listId, updated_at: new Date().toISOString() });

    await this.recomputeStatus(listId);

    return { processed: videoIds.length, succeeded: videoIds.length };
  }

  async removeVideos(listId: number, videoIds: number[]) {
    await knex('videos')
      .where({ video_list_id: listId })
      .whereIn('id', videoIds)
      .update({ video_list_id: null, updated_at: new Date().toISOString() });

    await this.recomputeStatus(listId);

    return { processed: videoIds.length };
  }

  async updateName(id: number, name: string) {
    await knex('video_lists').where({ id }).update({ name, updated_at: new Date().toISOString() });
    return { ok: true };
  }

  async delete(id: number) {
    await knex('videos')
      .where({ video_list_id: id })
      .update({ video_list_id: null, updated_at: new Date().toISOString() });
    await videoListRepository.delete(id);
    return { ok: true };
  }

  /**
   * Run a video operation against the whole list. Status-changing operations are
   * applied to every video so the list advances through the pipeline as a unit;
   * the list status is recomputed afterwards.
   */
  async batchOperation(
    listId: number,
    operation: string,
    videoIds?: number[],
    tagName?: string,
    confirm?: boolean,
  ) {
    const list = await videoListRepository.findById(listId);
    if (!list) throw AppError.notFound('List not found');

    if (operation === 'removeFromList') {
      const ids =
        Array.isArray(videoIds) && videoIds.length > 0
          ? videoIds
          : await videoListRepository.getVideoIds(listId);
      await knex('videos')
        .where({ video_list_id: listId })
        .whereIn('id', ids)
        .update({ video_list_id: null, updated_at: new Date().toISOString() });
      const status = await this.recomputeStatus(listId);
      return { operation, processed: ids.length, succeeded: ids.length, status };
    }

    const allIds = await videoListRepository.getVideoIds(listId);
    if (allIds.length === 0) {
      throw AppError.badRequest('List has no videos');
    }

    if (TAG_OPERATIONS.includes(operation as (typeof TAG_OPERATIONS)[number])) {
      if (!tagName) {
        throw AppError.badRequest(`tagName is required for ${operation}`);
      }
      const result =
        operation === 'addTag'
          ? await videoService.batchAddTags(allIds, tagName, confirm)
          : await videoService.batchRemoveTags(allIds, tagName);
      // Tag operations don't change status, but recompute keeps the column accurate.
      const status = await this.recomputeStatus(listId);
      return { operation, ...result, status };
    }

    if (STATUS_OPERATIONS.includes(operation as (typeof STATUS_OPERATIONS)[number])) {
      let result;
      if (operation === 'confirmDownload') {
        result = await videoService.batchConfirmDownload(allIds);
      } else if (operation === 'complete') {
        result = await videoService.batchComplete(allIds);
      } else {
        result = await videoService.batchIgnore(allIds);
      }
      const status = await this.recomputeStatus(listId);
      return { operation, ...result, status };
    }

    if (operation === 'reparse') {
      const result = await parserService.reparseBatch(allIds);
      const status = await this.recomputeStatus(listId);
      return { operation, processed: allIds.length, succeeded: result.updated, status };
    }

    throw AppError.badRequest(`Unsupported operation '${operation}'`);
  }

  /**
   * Validate that videos can be assigned to a list and return their shared status.
   * Throws 409 when a video already belongs to another list, or when statuses are
   * not homogeneous (either among themselves, or against the target list's status).
   */
  private async ensureVideosCanBeAssigned(
    videoIds: number[],
    listId?: number,
    listStatus?: string | null,
  ): Promise<string | null> {
    if (videoIds.length === 0) return listStatus ?? null;

    const rows = await knex('videos')
      .select('id', 'video_list_id', 'status')
      .whereIn('id', videoIds);
    if (rows.length !== videoIds.length) {
      throw AppError.badRequest('Some videos not found');
    }

    const alreadyAssigned = rows.find(
      (v) => v.video_list_id !== null && v.video_list_id !== listId,
    );
    if (alreadyAssigned) {
      throw new AppError(409, 'One or more videos already belongs to another list', 'CONFLICT');
    }

    const statuses = [...new Set(rows.map((r) => r.status as string))];

    if (listStatus != null) {
      const mismatch = statuses.find((s) => s !== listStatus);
      if (mismatch) {
        throw new AppError(
          409,
          `Cannot add video with status '${mismatch}' to a list with status '${listStatus}'`,
          'CONFLICT',
        );
      }
      return listStatus;
    }

    if (statuses.length > 1) {
      throw new AppError(
        409,
        `All videos in a list must share one status, got: ${statuses.join(', ')}`,
        'CONFLICT',
      );
    }

    return statuses[0] ?? null;
  }

  /** Recompute and persist the list status from its current members. */
  private async recomputeStatus(listId: number): Promise<string | null> {
    const statuses = await videoListRepository.getMemberStatuses(listId);
    const next = statuses.length === 1 ? statuses[0] : null;
    await videoListRepository.update(listId, { status: next });
    return next;
  }
}

export const videoListService = new VideoListService();
