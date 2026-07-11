import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { knex } from '@vidpulse/db';
import { fileRepository } from '@vidpulse/db';

const { mockProbeDimensions } = vi.hoisted(() => ({ mockProbeDimensions: vi.fn() }));
vi.mock('./file-probe.service', () => ({ probeDimensions: mockProbeDimensions }));

import { fileService } from './file.service';

// Integration test against the migrated test DB (see tests/vitest.global-setup.ts).
// Covers youtube_id extraction and the upsert + auto-link-by-youtube_id logic.

const YT = 'dQw4w9WgXcQ'; // valid 11-char youtube id
const DIR = '/tmp/vidpulse-files-test';
let channelId: number;
let videoId: number;

describe('fileService.extractYoutubeId', () => {
  it('extracts the 11-char prefix when followed by a separator', () => {
    expect(fileService.extractYoutubeId(`${YT}_My Song.mp4`)).toBe(YT);
    expect(fileService.extractYoutubeId(`${YT}.mkv`)).toBe(YT);
    expect(fileService.extractYoutubeId(`${YT} - title.webm`)).toBe(YT);
  });

  it('returns null when the filename does not start with an id-like token', () => {
    expect(fileService.extractYoutubeId('My Song.mp4')).toBeNull();
    // 11 alphanumerics immediately followed by a 12th id-char is not a clean prefix.
    expect(fileService.extractYoutubeId(`${YT}X.mp4`)).toBeNull();
  });
});

describe('fileService linking by youtube_id', () => {
  beforeEach(async () => {
    const [chan] = await knex('channels')
      .insert({ youtube_id: 'file-test-channel', title: 'file test' })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
    const [vid] = await knex('videos')
      .insert({ youtube_id: YT, channel_id: channelId, original_title: 'rick', status: 'new' })
      .returning('id');
    videoId = typeof vid === 'object' ? vid.id : vid;
  });

  afterEach(async () => {
    await knex('files').where('directory', DIR).delete();
    await knex('videos').where('youtube_id', YT).delete();
    await knex('channels').where('youtube_id', 'file-test-channel').delete();
  });

  it('links a file to its video when the youtube_id prefix matches', async () => {
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1234,
      youtube_id: YT,
      video_id: null,
    });
    await fileRepository.upsert({
      filename: 'unmatched.mp4',
      directory: DIR,
      extension: '.mp4',
      size_bytes: 10,
      youtube_id: null,
      video_id: null,
    });

    const linked = await fileRepository.linkAllByYoutubeId();
    expect(linked).toBe(1);

    const { files } = await fileRepository.getAll({ videoId });
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe(`${YT}_song.mp4`);
    expect(files[0].video_title).toBe('rick');
  });

  it('upsert is idempotent on (directory, filename) and refreshes metadata', async () => {
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: YT,
      video_id: null,
    });
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 999,
      youtube_id: YT,
      video_id: null,
    });

    const { files, total } = await fileRepository.getAll({});
    const mine = files.filter((f) => f.directory === DIR);
    expect(mine).toHaveLength(1);
    expect(mine[0].size_bytes).toBe(999);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});

// Dimension probing on link — probeDimensions itself (real ffprobe wrapper) is covered by
// file-probe.service.test.ts; here it's mocked so no real ffprobe binary is ever invoked.
describe('fileService dimension probing', () => {
  beforeEach(async () => {
    mockProbeDimensions.mockReset();
    const [chan] = await knex('channels')
      .insert({ youtube_id: 'file-test-channel', title: 'file test' })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
    const [vid] = await knex('videos')
      .insert({ youtube_id: YT, channel_id: channelId, original_title: 'rick', status: 'new' })
      .returning('id');
    videoId = typeof vid === 'object' ? vid.id : vid;
  });

  afterEach(async () => {
    await knex('files').where('directory', DIR).delete();
    await knex('videos').where('youtube_id', YT).delete();
    await knex('channels').where('youtube_id', 'file-test-channel').delete();
  });

  it('probes and persists dimensions when linking a previously-unprobed file', async () => {
    mockProbeDimensions.mockResolvedValue({ width: 1080, height: 1920 });
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: null,
    });
    const { files } = await fileRepository.getAll({});
    const file = files.find((f) => f.directory === DIR)!;

    await fileService.linkVideo(file.id, videoId);

    expect(mockProbeDimensions).toHaveBeenCalledTimes(1);
    const linked = await fileRepository.getById(file.id);
    expect(linked).toMatchObject({ width: 1080, height: 1920 });
  });

  it('does not re-probe a file that already has dimensions', async () => {
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: null,
    });
    const { files } = await fileRepository.getAll({});
    const file = files.find((f) => f.directory === DIR)!;
    await fileRepository.updateDimensions(file.id, 640, 480);

    await fileService.linkVideo(file.id, videoId);

    expect(mockProbeDimensions).not.toHaveBeenCalled();
  });

  it('does not probe when unlinking a file', async () => {
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: videoId,
    });
    const { files } = await fileRepository.getAll({});
    const file = files.find((f) => f.directory === DIR)!;

    await fileService.linkVideo(file.id, null);

    expect(mockProbeDimensions).not.toHaveBeenCalled();
  });

  it('probeUnprobedFiles probes every linked-but-unprobed file and skips failed probes', async () => {
    await fileRepository.upsert({
      filename: `${YT}_a.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: videoId,
    });
    await fileRepository.upsert({
      filename: `${YT}_b.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: videoId,
    });
    mockProbeDimensions
      .mockResolvedValueOnce({ width: 1920, height: 1080 })
      .mockResolvedValueOnce(null);

    const result = await fileService.probeUnprobedFiles();

    expect(result.probed).toBe(1);
    const { files } = await fileRepository.getAll({ videoId });
    const probedFiles = files.filter((f) => f.width != null);
    const unprobedFiles = files.filter((f) => f.width == null);
    expect(probedFiles).toHaveLength(1);
    expect(probedFiles[0]).toMatchObject({ width: 1920, height: 1080 });
    expect(unprobedFiles).toHaveLength(1);
  });
});
