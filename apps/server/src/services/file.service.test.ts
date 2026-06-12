import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { fileRepository } from '@vidpulse/db';
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
