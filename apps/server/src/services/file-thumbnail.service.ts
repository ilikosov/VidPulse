import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const THUMBNAIL_COUNT = 3;

/** Encode raw JPEG bytes as a base64 data URI for direct rendering in an <img>/<Image> src. */
export function bufferToDataUri(image: Buffer): string {
  return `data:image/jpeg;base64,${image.toString('base64')}`;
}

/**
 * Extracts a few evenly-spaced frames from a video file as raw JPEG buffers. Never throws —
 * resolves an empty array on any ffmpeg failure (missing binary, corrupt file, no video stream,
 * etc.), the same "probe, don't fail the caller" convention as `file-probe.service.ts`. The
 * caller decides whether to persist the bytes or encode them for transport.
 */
export function generateThumbnailBuffers(filePath: string): Promise<Buffer[]> {
  return new Promise((resolve) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidpulse-thumb-'));
    const cleanup = () => fs.rmSync(tmpDir, { recursive: true, force: true });

    ffmpeg(filePath)
      .on('end', () => {
        try {
          const buffers = fs
            .readdirSync(tmpDir)
            .sort()
            .map((f) => fs.readFileSync(path.join(tmpDir, f)));
          resolve(buffers);
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
