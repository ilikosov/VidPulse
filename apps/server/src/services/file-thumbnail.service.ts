import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const THUMBNAIL_COUNT = 3;

/**
 * Extracts a few evenly-spaced frames from a video file as base64 JPEG data URIs. Never throws
 * — resolves an empty array on any ffmpeg failure (missing binary, corrupt file, no video
 * stream, etc.), the same "probe, don't fail the caller" convention as `file-probe.service.ts`.
 */
export function generateThumbnails(filePath: string): Promise<string[]> {
  return new Promise((resolve) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidpulse-thumb-'));
    const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });

    ffmpeg(filePath)
      .on('end', () => {
        try {
          const dataUris = fs
            .readdirSync(tmpDir)
            .sort()
            .map(
              (f) =>
                `data:image/jpeg;base64,${fs.readFileSync(path.join(tmpDir, f)).toString('base64')}`,
            );
          resolve(dataUris);
        } catch {
          resolve([]);
        } finally {
          cleanup();
        }
      })
      .on('error', () => {
        cleanup();
        resolve([]);
      })
      .screenshots({ count: THUMBNAIL_COUNT, folder: tmpDir, filename: 'thumb-%i.jpg' });
  });
}
