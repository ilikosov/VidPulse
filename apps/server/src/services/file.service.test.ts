import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { knex } from '@vidpulse/db';
import { fileRepository } from '@vidpulse/db';

const { mockProbeDimensions } = vi.hoisted(() => ({ mockProbeDimensions: vi.fn() }));
vi.mock('./file-probe.service', () => ({ probeDimensions: mockProbeDimensions }));

// Mock only frame extraction (no real ffmpeg); bufferToDataUri stays real via importOriginal.
const { mockGenerateThumbnailBuffers } = vi.hoisted(() => ({
  mockGenerateThumbnailBuffers: vi.fn(),
}));
vi.mock('./file-thumbnail.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./file-thumbnail.service')>()),
  generateThumbnailBuffers: mockGenerateThumbnailBuffers,
}));

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

describe('fileService.getFileDetails', () => {
  const originalTemplate = process.env.RENAME_TEMPLATE_VIDEO;

  beforeEach(async () => {
    const [chan] = await knex('channels')
      .insert({ youtube_id: 'file-test-channel', title: 'file test' })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
    const [vid] = await knex('videos')
      .insert({
        youtube_id: YT,
        channel_id: channelId,
        original_title: 'rick',
        group_name: 'RICKROLL',
        status: 'new',
      })
      .returning('id');
    videoId = typeof vid === 'object' ? vid.id : vid;
  });

  afterEach(async () => {
    if (originalTemplate === undefined) delete process.env.RENAME_TEMPLATE_VIDEO;
    else process.env.RENAME_TEMPLATE_VIDEO = originalTemplate;

    await knex('files').where('directory', DIR).delete();
    await knex('videos').where('youtube_id', YT).delete();
    await knex('channels').where('youtube_id', 'file-test-channel').delete();
  });

  it('computes predicted_filename for a linked file when a rename template is configured', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: videoId,
    });
    const { files } = await fileRepository.getAll({ videoId });

    const details = await fileService.getFileDetails(files[0].id);

    expect(details.predicted_filename).toBe('RICKROLL.mp4');
  });

  it('leaves predicted_filename null when the file is not linked to a video', async () => {
    process.env.RENAME_TEMPLATE_VIDEO = '{{video.group_name}}';
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

    const details = await fileService.getFileDetails(file.id);

    expect(details.predicted_filename).toBeNull();
  });

  it('leaves predicted_filename null when no rename template is configured', async () => {
    delete process.env.RENAME_TEMPLATE_VIDEO;
    await fileRepository.upsert({
      filename: `${YT}_song.mp4`,
      directory: DIR,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: videoId,
    });
    const { files } = await fileRepository.getAll({ videoId });

    const details = await fileService.getFileDetails(files[0].id);

    expect(details.predicted_filename).toBeNull();
  });
});

describe('fileService preview storage', () => {
  const onDiskDir = fs.mkdtempSync(path.join('/tmp', 'vidpulse-prev-'));
  const filename = 'clip.mp4';
  let fileId: number;

  beforeEach(async () => {
    mockGenerateThumbnailBuffers.mockReset();
    fs.writeFileSync(path.join(onDiskDir, filename), Buffer.from('video-bytes'));
    await fileRepository.upsert({
      filename,
      directory: onDiskDir,
      extension: '.mp4',
      size_bytes: 1,
      youtube_id: null,
      video_id: null,
    });
    const { files } = await fileRepository.getAll({});
    fileId = files.find((f) => f.directory === onDiskDir)!.id;
  });

  afterEach(async () => {
    await knex('files').where('directory', onDiskDir).delete();
  });

  it('generates, stores, and reads back previews as data URIs', async () => {
    mockGenerateThumbnailBuffers.mockResolvedValue([
      Buffer.from('frame-a'),
      Buffer.from('frame-b'),
    ]);

    const generated = await fileService.generatePreviews(fileId);
    expect(generated).toEqual([
      `data:image/jpeg;base64,${Buffer.from('frame-a').toString('base64')}`,
      `data:image/jpeg;base64,${Buffer.from('frame-b').toString('base64')}`,
    ]);

    // getThumbnails reads from storage without touching ffmpeg.
    const stored = await fileService.getThumbnails(fileId);
    expect(stored).toEqual(generated);
  });

  it('replaces the previous set on regeneration instead of appending', async () => {
    mockGenerateThumbnailBuffers.mockResolvedValueOnce([Buffer.from('a'), Buffer.from('b')]);
    await fileService.generatePreviews(fileId);
    mockGenerateThumbnailBuffers.mockResolvedValueOnce([Buffer.from('c')]);
    await fileService.generatePreviews(fileId);

    const stored = await fileRepository.getPreviews(fileId);
    expect(stored.map((b) => b.toString())).toEqual(['c']);
  });

  it('returns [] from getThumbnails until previews are generated', async () => {
    expect(await fileService.getThumbnails(fileId)).toEqual([]);
  });

  it('reports exists_on_disk in getFileDetails (true when present, false when missing)', async () => {
    const present = await fileService.getFileDetails(fileId);
    expect(present.exists_on_disk).toBe(true);

    fs.rmSync(path.join(onDiskDir, filename));
    const missing = await fileService.getFileDetails(fileId);
    expect(missing.exists_on_disk).toBe(false);
  });

  it('rejects generation when the file is not on disk', async () => {
    fs.rmSync(path.join(onDiskDir, filename));
    await expect(fileService.generatePreviews(fileId)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockGenerateThumbnailBuffers).not.toHaveBeenCalled();
  });

  it('cascade-deletes stored previews when the file row is removed', async () => {
    mockGenerateThumbnailBuffers.mockResolvedValue([Buffer.from('x')]);
    await fileService.generatePreviews(fileId);
    expect(await knex('file_previews').where('file_id', fileId)).toHaveLength(1);

    await fileService.deleteFile(fileId);
    expect(await knex('file_previews').where('file_id', fileId)).toHaveLength(0);
  });
});
