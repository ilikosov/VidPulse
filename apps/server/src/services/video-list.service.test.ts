import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex, fileRepository } from '@vidpulse/db';
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

// Regression coverage for predicted_filename / has_duplicate_name / duplicatesOnly / pagination
// added to getById. Uses its own prefix, channel, and RENAME_TEMPLATE_VIDEO env override so it
// doesn't interact with the status-semantics suite above.
describe('videoListService.getById — predicted filenames & pagination', () => {
  const GB_PREFIX = 'vl-getbyid-test-';
  let gbChannelId: number;
  const originalTemplate = process.env.RENAME_TEMPLATE_VIDEO;

  async function insertGroupVideo(suffix: string, groupName: string): Promise<number> {
    const [row] = await knex('videos')
      .insert({
        youtube_id: `${GB_PREFIX}${suffix}`,
        channel_id: gbChannelId,
        original_title: `test ${suffix}`,
        group_name: groupName,
        status: 'new',
      })
      .returning('id');
    return typeof row === 'object' ? row.id : row;
  }

  async function linkFileWithDimensions(
    videoId: number,
    width: number,
    height: number,
  ): Promise<void> {
    await fileRepository.upsert({
      filename: `file-${videoId}.mp4`,
      directory: '/tmp/vl-orientation-test',
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: videoId,
    });
    const { files } = await fileRepository.getAll({ videoId });
    await fileRepository.updateDimensions(files[0].id, width, height);
  }

  beforeEach(async () => {
    const [row] = await knex('channels')
      .insert({ youtube_id: `${GB_PREFIX}channel`, title: 'getById test channel' })
      .returning('id');
    gbChannelId = typeof row === 'object' ? row.id : row;
  });

  afterEach(async () => {
    if (originalTemplate === undefined) delete process.env.RENAME_TEMPLATE_VIDEO;
    else process.env.RENAME_TEMPLATE_VIDEO = originalTemplate;

    const ids = await knex('videos')
      .where('youtube_id', 'like', `${GB_PREFIX}%`)
      .pluck('video_list_id');
    const listIds = [...new Set(ids.filter((x): x is number => x != null))];
    await knex('files')
      .whereIn('video_id', knex('videos').select('id').where('youtube_id', 'like', `${GB_PREFIX}%`))
      .delete();
    await knex('videos').where('youtube_id', 'like', `${GB_PREFIX}%`).delete();
    if (listIds.length) await knex('video_lists').whereIn('id', listIds).delete();
    await knex('channels').where('youtube_id', `${GB_PREFIX}channel`).delete();
  });

  it('flags videos with a matching predicted filename as duplicates', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
    const a = await insertGroupVideo('a', 'SAME GROUP');
    const b = await insertGroupVideo('b', 'SAME GROUP');
    const c = await insertGroupVideo('c', 'OTHER GROUP');
    const created = await videoListService.create('dup-list', [a, b, c]);

    const result = await videoListService.getById(created.id!, { limit: 10 });

    const byId = new Map(result.videos.map((v) => [v.id, v]));
    expect(byId.get(a)?.predicted_filename).toBe('SAME GROUP');
    expect(byId.get(a)?.has_duplicate_name).toBe(true);
    expect(byId.get(b)?.has_duplicate_name).toBe(true);
    expect(byId.get(c)?.predicted_filename).toBe('OTHER GROUP');
    expect(byId.get(c)?.has_duplicate_name).toBe(false);
  });

  it('duplicatesOnly narrows videos but allVideoIds still lists the whole list', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
    const a = await insertGroupVideo('a', 'DUP GROUP');
    const b = await insertGroupVideo('b', 'DUP GROUP');
    const c = await insertGroupVideo('c', 'UNIQUE GROUP');
    const created = await videoListService.create('dup-only-list', [a, b, c]);

    const result = await videoListService.getById(created.id!, {
      limit: 10,
      duplicatesOnly: true,
    });

    expect(result.videos.map((v) => v.id).sort()).toEqual([a, b].sort());
    expect(result.pagination.total).toBe(2);
    expect(result.allVideoIds.sort()).toEqual([a, b, c].sort());
  });

  it('predictedFilename narrows videos to an exact match, independent of allVideoIds', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
    const a = await insertGroupVideo('a', 'DUP GROUP');
    const b = await insertGroupVideo('b', 'DUP GROUP');
    const c = await insertGroupVideo('c', 'UNIQUE GROUP');
    const created = await videoListService.create('filename-filter-list', [a, b, c]);

    const result = await videoListService.getById(created.id!, {
      limit: 10,
      predictedFilename: 'DUP GROUP',
    });

    expect(result.videos.map((v) => v.id).sort()).toEqual([a, b].sort());
    expect(result.pagination.total).toBe(2);
    expect(result.allVideoIds.sort()).toEqual([a, b, c].sort());
  });

  it('combines predictedFilename with duplicatesOnly without conflict', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
    const a = await insertGroupVideo('a', 'DUP GROUP');
    const b = await insertGroupVideo('b', 'DUP GROUP');
    const c = await insertGroupVideo('c', 'UNIQUE GROUP');
    const created = await videoListService.create('filename-filter-combo-list', [a, b, c]);

    const result = await videoListService.getById(created.id!, {
      limit: 10,
      duplicatesOnly: true,
      predictedFilename: 'DUP GROUP',
    });

    expect(result.videos.map((v) => v.id).sort()).toEqual([a, b].sort());
    expect(result.pagination.total).toBe(2);
  });

  it('predictedFilename with no matching video returns an empty page', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
    const a = await insertGroupVideo('a', 'SOME GROUP');
    const created = await videoListService.create('filename-filter-empty-list', [a]);

    const result = await videoListService.getById(created.id!, {
      limit: 10,
      predictedFilename: 'NO SUCH FILENAME',
    });

    expect(result.videos).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('paginates the (possibly filtered) result', async () => {
    const a = await insertGroupVideo('a', 'G1');
    const b = await insertGroupVideo('b', 'G2');
    const c = await insertGroupVideo('c', 'G3');
    const created = await videoListService.create('page-list', [a, b, c]);

    const page1 = await videoListService.getById(created.id!, { page: 1, limit: 2 });
    expect(page1.videos).toHaveLength(2);
    expect(page1.pagination).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const page2 = await videoListService.getById(created.id!, { page: 2, limit: 2 });
    expect(page2.videos).toHaveLength(1);
    expect(page2.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('renders {{video.orientation}} from the linked file dimensions and flags matching orientations as duplicates', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.orientation}}';
    const a = await insertGroupVideo('a', 'G');
    const b = await insertGroupVideo('b', 'G');
    const c = await insertGroupVideo('c', 'G');
    await linkFileWithDimensions(a, 1080, 1920); // portrait → vertical
    await linkFileWithDimensions(b, 720, 1280); // portrait → vertical
    await linkFileWithDimensions(c, 1920, 1080); // landscape → horizontal
    const created = await videoListService.create('orientation-list', [a, b, c]);

    const result = await videoListService.getById(created.id!, { limit: 10 });

    const byId = new Map(result.videos.map((v) => [v.id, v]));
    expect(byId.get(a)?.predicted_filename).toBe('vertical');
    expect(byId.get(a)?.has_duplicate_name).toBe(true);
    expect(byId.get(b)?.has_duplicate_name).toBe(true);
    expect(byId.get(c)?.predicted_filename).toBe('horizontal');
    expect(byId.get(c)?.has_duplicate_name).toBe(false);
  });

  it('leaves predicted_filename null and has_duplicate_name false when no template is configured', async () => {
    delete process.env.RENAME_TEMPLATE_VIDEO;
    const a = await insertGroupVideo('a', 'SOME GROUP');
    const b = await insertGroupVideo('b', 'SOME GROUP');
    const created = await videoListService.create('no-template-list', [a, b]);

    const result = await videoListService.getById(created.id!, { limit: 10 });

    expect(result.videos.every((v) => v.predicted_filename === null)).toBe(true);
    expect(result.videos.every((v) => v.has_duplicate_name === false)).toBe(true);
  });
});
