import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex, videoRepository } from '@vidpulse/db';

// Integration test against the migrated test DB (see tests/vitest.global-setup.ts).
// Verifies the videoListId filter on the videos listing query (findAllDisplay/countAll).

const YT_PREFIX = 'vl-filter-test-';
let channelId: number;
let listA: number;
let listB: number;

async function insertList(name: string, color: string): Promise<number> {
  const [row] = await knex('video_lists')
    .insert({ name: `${YT_PREFIX}${name}`, color })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertVideo(suffix: string, videoListId: number | null): Promise<number> {
  const [row] = await knex('videos')
    .insert({
      youtube_id: `${YT_PREFIX}${suffix}`,
      channel_id: channelId,
      original_title: `test ${suffix}`,
      status: 'new',
      video_list_id: videoListId,
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

describe('videoRepository videoListId filter', () => {
  beforeEach(async () => {
    const [row] = await knex('channels')
      .insert({ youtube_id: `${YT_PREFIX}channel`, title: 'test channel' })
      .returning('id');
    channelId = typeof row === 'object' ? row.id : row;
    listA = await insertList('list-a', '#aaaaaa');
    listB = await insertList('list-b', '#bbbbbb');
  });

  afterEach(async () => {
    await knex('videos').where('youtube_id', 'like', `${YT_PREFIX}%`).delete();
    await knex('video_lists').where('name', 'like', `${YT_PREFIX}%`).delete();
    await knex('channels').where('youtube_id', `${YT_PREFIX}channel`).delete();
  });

  it('returns only videos belonging to the given list', async () => {
    await insertVideo('a1', listA);
    await insertVideo('a2', listA);
    await insertVideo('b1', listB);
    await insertVideo('none', null);

    const filters = { videoListId: String(listA) };
    const rows = await videoRepository.findAllDisplay(filters, { limit: 100, offset: 0 });
    const ours = rows.filter((v) => v.youtube_id.startsWith(YT_PREFIX));

    expect(ours).toHaveLength(2);
    expect(ours.every((v) => v.video_list_id === listA)).toBe(true);
    expect(await videoRepository.countAll(filters)).toBe(2);
  });
});
