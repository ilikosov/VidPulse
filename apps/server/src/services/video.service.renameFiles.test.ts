import { config } from '../config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { knex, fileRepository } from '@vidpulse/db';
import { videoService } from './video.service';

// Integration test against the migrated test DB + a real temp directory on disk (renameFiles
// performs actual fs.rename calls). Regression coverage for two bugs found in code review:
// (1) one bad videoId in a batch used to throw and abort the whole request, discarding the
//     result for every video already processed earlier in the loop; (2) two files rendering to
//     the same destination name used to silently clobber each other via fs.rename.

const TAG = 'rename-files-test';
let channelId: number;
let srcDir: string;
let outDir: string;

function makeSourceFile(name: string, contents = 'x'): void {
  fs.writeFileSync(path.join(srcDir, name), contents);
}

async function seedVideo(youtubeId: string, groupName: string): Promise<number> {
  const [row] = await knex('videos')
    .insert({
      youtube_id: youtubeId,
      channel_id: channelId,
      original_title: TAG,
      group_name: groupName,
      status: 'new',
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function seedFile(
  videoId: number,
  filename: string,
  dims?: { width: number; height: number },
): Promise<void> {
  await fileRepository.upsert({
    filename,
    directory: srcDir,
    extension: path.extname(filename),
    size_bytes: 1,
    youtube_id: null,
    video_id: videoId,
  });
  if (dims) {
    const { files } = await fileRepository.getAll({ videoId });
    const file = files.find((f) => f.filename === filename)!;
    await fileRepository.updateDimensions(file.id, dims.width, dims.height);
  }
}

describe('videoService.renameFiles', () => {
  beforeAll(async () => {
    srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidpulse-rename-src-'));
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidpulse-rename-out-'));
    config.files.renameTemplate = '{{video.group_name}}';
    config.files.outputDir = outDir;

    const [chan] = await knex('channels')
      .insert({ youtube_id: `${TAG}-channel`, title: TAG })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
  });

  afterAll(async () => {
    config.files.renameTemplate = null;
    config.files.outputDir = null;
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
    await knex('videos').where('original_title', TAG).delete();
    await knex('channels').where('id', channelId).delete();
  });

  afterEach(async () => {
    await knex('files')
      .whereIn('video_id', knex('videos').select('id').where('original_title', TAG))
      .delete();
    await knex('videos').where('original_title', TAG).delete();
    for (const f of fs.readdirSync(srcDir)) fs.rmSync(path.join(srcDir, f));
    for (const f of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, f));
  });

  it("renames a video's linked file into FILES_OUTPUT_DIR", async () => {
    const videoId = await seedVideo(`${TAG}-1`, 'HAPPY GROUP');
    makeSourceFile('src1.mp4');
    await seedFile(videoId, 'src1.mp4');

    const result = await videoService.renameFiles([videoId]);

    expect(result).toEqual({ moved: 1, skipped: 0, errors: [] });
    expect(fs.existsSync(path.join(outDir, 'HAPPY GROUP.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'src1.mp4'))).toBe(false);
    const { files } = await fileRepository.getAll({ videoId });
    expect(files[0]).toMatchObject({ directory: outDir, filename: 'HAPPY GROUP.mp4' });
  });

  it('skips a video with no linked file', async () => {
    const videoId = await seedVideo(`${TAG}-2`, 'NO FILE GROUP');

    const result = await videoService.renameFiles([videoId]);

    expect(result).toEqual({ moved: 0, skipped: 1, errors: [] });
  });

  it('isolates a bad videoId — does not abort the rest of the batch', async () => {
    const videoId = await seedVideo(`${TAG}-3`, 'ISOLATION GROUP');
    makeSourceFile('src3.mp4');
    await seedFile(videoId, 'src3.mp4');

    const result = await videoService.renameFiles([videoId, 999999999]);

    expect(result.moved).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('999999999');
    expect(fs.existsSync(path.join(outDir, 'ISOLATION GROUP.mp4'))).toBe(true);
  });

  it('does not clobber a file when two videos render the same destination name', async () => {
    const videoA = await seedVideo(`${TAG}-4a`, 'COLLISION GROUP');
    const videoB = await seedVideo(`${TAG}-4b`, 'COLLISION GROUP');
    makeSourceFile('srcA.mp4', 'AAA');
    makeSourceFile('srcB.mp4', 'BBB');
    await seedFile(videoA, 'srcA.mp4');
    await seedFile(videoB, 'srcB.mp4');

    const result = await videoService.renameFiles([videoA, videoB]);

    expect(result.moved).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('already exists');
    // The winner's content made it through untouched...
    expect(fs.readFileSync(path.join(outDir, 'COLLISION GROUP.mp4'), 'utf8')).toBe('AAA');
    // ...and the loser's source file was left in place, not clobbered.
    expect(fs.existsSync(path.join(srcDir, 'srcB.mp4'))).toBe(true);
  });

  it('is idempotent when the file is already at its destination', async () => {
    const videoId = await seedVideo(`${TAG}-5`, 'IDEMPOTENT GROUP');
    makeSourceFile('src5.mp4');
    await seedFile(videoId, 'src5.mp4');

    await videoService.renameFiles([videoId]);
    const second = await videoService.renameFiles([videoId]);

    expect(second).toEqual({ moved: 1, skipped: 0, errors: [] });
  });

  it('renders {{video.orientation}} from the linked file dimensions', async () => {
    const videoId = await seedVideo(`${TAG}-6`, 'ORIENTATION GROUP');
    makeSourceFile('src6.mp4');
    await seedFile(videoId, 'src6.mp4', { width: 1080, height: 1920 });

    const originalTemplate = config.files.renameTemplate;
    config.files.renameTemplate = '{{video.orientation}}';
    try {
      const result = await videoService.renameFiles([videoId]);

      expect(result).toEqual({ moved: 1, skipped: 0, errors: [] });
      expect(fs.existsSync(path.join(outDir, 'vertical.mp4'))).toBe(true);
    } finally {
      config.files.renameTemplate = originalTemplate;
    }
  });
});
