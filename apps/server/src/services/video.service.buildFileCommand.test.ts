import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { knex, fileRepository } from '@vidpulse/db';
import { videoService } from './video.service';
import { config } from '../config';

// Integration test against the migrated test DB (see tests/vitest.global-setup.ts).

const PFX = 'bfc-test-';
const dir = fs.mkdtempSync(path.join('/tmp', 'bfc-'));
const originalCmd = config.files.shellCommand;
let chId: number;

async function insertVideo(suffix: string): Promise<number> {
  const [row] = await knex('videos')
    .insert({
      youtube_id: `${PFX}${suffix}`,
      channel_id: chId,
      original_title: `t ${suffix}`,
      status: 'new',
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function linkFile(videoId: number, filename: string, onDisk: boolean): Promise<void> {
  if (onDisk) fs.writeFileSync(path.join(dir, filename), Buffer.from('x'));
  await fileRepository.upsert({
    filename,
    directory: dir,
    extension: '.mp4',
    size_bytes: 1,
    youtube_id: null,
    video_id: videoId,
  });
}

describe('videoService.buildFileCommand — excludeExistingFiles', () => {
  beforeEach(async () => {
    config.files.shellCommand = 'dl {{each video}}{{video.youtube_id}} {{/each}}';
    const [row] = await knex('channels')
      .insert({ youtube_id: `${PFX}channel`, title: 't' })
      .returning('id');
    chId = typeof row === 'object' ? row.id : row;
  });

  afterEach(async () => {
    if (originalCmd === undefined) config.files.shellCommand = null;
    else config.files.shellCommand = originalCmd;
    await knex('files').where('directory', dir).delete();
    await knex('videos').where('youtube_id', 'like', `${PFX}%`).delete();
    await knex('channels').where('youtube_id', `${PFX}channel`).delete();
  });

  it('excludes videos whose linked file exists on disk', async () => {
    const withFile = await insertVideo('withfile');
    const withoutFile = await insertVideo('nofile');
    await linkFile(withFile, 'present.mp4', true);

    const res = await videoService.buildFileCommand([withFile, withoutFile], {
      excludeExistingFiles: true,
    });

    expect(res.excluded).toBe(1);
    expect(res.command).toContain(`${PFX}nofile`);
    expect(res.command).not.toContain(`${PFX}withfile`);
  });

  it('includes every video when the flag is off', async () => {
    const withFile = await insertVideo('withfile');
    const withoutFile = await insertVideo('nofile');
    await linkFile(withFile, 'present.mp4', true);

    const res = await videoService.buildFileCommand([withFile, withoutFile]);

    expect(res.excluded).toBe(0);
    expect(res.command).toContain(`${PFX}withfile`);
    expect(res.command).toContain(`${PFX}nofile`);
  });

  it('keeps a linked video whose file is missing on disk', async () => {
    const linkedMissing = await insertVideo('missing');
    await linkFile(linkedMissing, 'gone.mp4', false);

    const res = await videoService.buildFileCommand([linkedMissing], {
      excludeExistingFiles: true,
    });

    expect(res.excluded).toBe(0);
    expect(res.command).toContain(`${PFX}missing`);
  });
});
