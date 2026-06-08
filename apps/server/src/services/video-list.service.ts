import knex from '../db';
import { videoListRepository } from '../repositories/knex.repositories';
import { AppError } from '../middleware/AppError';
import { config } from '../config';

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

class VideoListService {
  async create(name: string, videoIds?: number[]) {
    const ids = videoIds ?? [];
    if (ids.length > MAX_VIDEO_LIST_ITEMS) {
      throw new AppError(409, 'Video list limit exceeded', 'CONFLICT');
    }

    await this.ensureVideosCanBeAssigned(ids);

    const allLists = await videoListRepository.findAll();
    const usedColors = allLists.map((l) => l.color);
    const color = COLORS.find((c) => !usedColors.includes(c)) || `custom-${Date.now()}`;

    const listId = await videoListRepository.create({ name, color } as any);
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
      .select('l.id', 'l.name', 'l.color')
      .count<{ countVideos: number }>('v.id as countVideos');
    return lists;
  }

  async getById(id: number) {
    const list = await videoListRepository.findById(id);
    if (!list) throw AppError.notFound('List not found');

    const { videos } = await videoListRepository.findWithVideos(id);
    return { ...list, videos: Array.from(videos.values()) };
  }

  async addVideos(listId: number, videoIds: number[]) {
    const list = await videoListRepository.findById(listId);
    if (!list) throw AppError.notFound('List not found');

    const currentCount = await videoListRepository.videoCount(listId);
    if (currentCount + videoIds.length > MAX_VIDEO_LIST_ITEMS) {
      throw new AppError(409, 'Video list limit exceeded', 'CONFLICT');
    }

    await this.ensureVideosCanBeAssigned(videoIds, listId);

    await knex('videos')
      .whereIn('id', videoIds)
      .update({ video_list_id: listId, updated_at: new Date().toISOString() });

    return { processed: videoIds.length, succeeded: videoIds.length };
  }

  async removeVideos(listId: number, videoIds: number[]) {
    await knex('videos')
      .where({ video_list_id: listId })
      .whereIn('id', videoIds)
      .update({ video_list_id: null, updated_at: new Date().toISOString() });

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

  async batchOperation(listId: number, operation: string, videoIds: number[]) {
    if (
      !Array.isArray(videoIds) ||
      videoIds.length === 0 ||
      !videoIds.every((id) => Number.isInteger(id) && id > 0)
    ) {
      throw AppError.badRequest('videoIds must be non-empty array of positive integers');
    }

    if (operation === 'removeFromList') {
      await knex('videos')
        .where({ video_list_id: listId })
        .whereIn('id', videoIds)
        .update({ video_list_id: null, updated_at: new Date().toISOString() });
      return { operation, processed: videoIds.length, succeeded: videoIds.length };
    }

    if (operation === 'addTag' || operation === 'removeTag') {
      throw AppError.badRequest(`Use /api/videos/batch/tags for ${operation} with tagName`);
    }

    return { operation, processed: videoIds.length, succeeded: 0, skipped: videoIds.length };
  }

  private async ensureVideosCanBeAssigned(videoIds: number[], listId?: number) {
    if (videoIds.length === 0) return;
    const rows = await knex('videos').select('id', 'video_list_id').whereIn('id', videoIds);
    if (rows.length !== videoIds.length) {
      throw AppError.badRequest('Some videos not found');
    }
    const alreadyAssigned = rows.find(
      (v) => v.video_list_id !== null && v.video_list_id !== listId,
    );
    if (alreadyAssigned) {
      throw new AppError(409, 'One or more videos already belongs to another list', 'CONFLICT');
    }
  }
}

export const videoListService = new VideoListService();
