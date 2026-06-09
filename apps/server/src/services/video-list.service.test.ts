import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import knex from '../db';
import { videoListService } from './video-list.service';

// Integration test against the migrated test DB (see tests/vitest.global-setup.ts).
// Exercises the status-homogeneity rules and whole-list operations.

const YT_PREFIX = 'vl-status-test-';
let channelId: number;

async function insertVideo(suffix: string, status: string): Promise<number> {
  const [row] = await knex('videos')
    .insert({
      youtube_id: `${YT_PREFIX}${suffix}`,
      channel_id: channelId,
      original_title: `test ${suffix}`,
      status,
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

describe('videoListService status semantics', () => {
  beforeEach(async () => {
    const [row] = await knex('channels')
      .insert({ youtube_id: `${YT_PREFIX}channel`, title: 'test channel' })
      .returning('id');
    channelId = typeof row === 'object' ? row.id : row;
  });

  afterEach(async () => {
    const ids = await knex('videos')
      .where('youtube_id', 'like', `${YT_PREFIX}%`)
      .pluck('video_list_id');
    const listIds = [...new Set(ids.filter((x): x is number => x != null))];
    await knex('videos').where('youtube_id', 'like', `${YT_PREFIX}%`).delete();
    if (listIds.length) await knex('video_lists').whereIn('id', listIds).delete();
    await knex('channels').where('youtube_id', `${YT_PREFIX}channel`).delete();
  });

  it('sets list status from homogeneous videos on create', async () => {
    const a = await insertVideo('a', 'new');
    const b = await insertVideo('b', 'new');

    const created = await videoListService.create('homogeneous', [a, b]);

    expect(created.status).toBe('new');
  });

  it('rejects creating a list from videos with mixed statuses (409)', async () => {
    const a = await insertVideo('a', 'new');
    const b = await insertVideo('b', 'downloaded');

    await expect(videoListService.create('mixed', [a, b])).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('rejects adding a video with a different status than the list (409)', async () => {
    const a = await insertVideo('a', 'new');
    const created = await videoListService.create('list', [a]);

    const b = await insertVideo('b', 'downloaded');

    await expect(videoListService.addVideos(created.id!, [b])).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('applies a status operation to the whole list and advances its status', async () => {
    const a = await insertVideo('a', 'new');
    const b = await insertVideo('b', 'new');
    const created = await videoListService.create('to-ignore', [a, b]);

    const result = await videoListService.batchOperation(created.id!, 'ignore');

    expect(result.succeeded).toBe(2);
    expect(result.status).toBe('ignored');
    const reloaded = await videoListService.getById(created.id!);
    expect(reloaded.status).toBe('ignored');
    expect(reloaded.videos.every((v) => v.status === 'ignored')).toBe(true);
  });

  it('clears the list status when it becomes empty', async () => {
    const a = await insertVideo('a', 'new');
    const created = await videoListService.create('emptying', [a]);

    await videoListService.removeVideos(created.id!, [a]);

    const reloaded = await videoListService.getById(created.id!);
    expect(reloaded.status).toBeNull();
  });
});
