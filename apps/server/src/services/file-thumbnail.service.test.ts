import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockFfmpegFactory } = vi.hoisted(() => ({ mockFfmpegFactory: vi.fn() }));
vi.mock('fluent-ffmpeg', () => ({ default: mockFfmpegFactory }));

import { bufferToDataUri, generateThumbnailBuffers } from './file-thumbnail.service';

/** Builds a fake chainable FfmpegCommand: `.on(event, cb)` registers a handler, and
 * `.screenshots(config)` invokes `onScreenshots` with the target folder + registered handlers
 * — the test decides whether that simulates a successful run or an ffmpeg failure. */
function makeChain(
  onScreenshots: (folder: string, handlers: Record<string, (...a: any[]) => void>) => void,
) {
  const handlers: Record<string, (...a: any[]) => void> = {};
  const chain = {
    on: vi.fn((event: string, cb: (...a: any[]) => void) => {
      handlers[event] = cb;
      return chain;
    }),
    screenshots: vi.fn((config: { folder: string }) => {
      onScreenshots(config.folder, handlers);
      return chain;
    }),
  };
  return chain;
}

describe('generateThumbnailBuffers', () => {
  it('resolves the generated screenshots as raw JPEG buffers, ordered by filename', async () => {
    mockFfmpegFactory.mockImplementation(() =>
      makeChain((folder, handlers) => {
        fs.writeFileSync(path.join(folder, 'thumb-1.jpg'), Buffer.from('fake-a'));
        fs.writeFileSync(path.join(folder, 'thumb-2.jpg'), Buffer.from('fake-b'));
        handlers.end?.();
      }),
    );

    const result = await generateThumbnailBuffers('/tmp/video.mp4');

    expect(result).toHaveLength(2);
    expect(result.every((b) => Buffer.isBuffer(b))).toBe(true);
    expect(result[0].toString()).toBe('fake-a');
    expect(result[1].toString()).toBe('fake-b');
  });

  it('resolves an empty array on an ffmpeg error (e.g. missing binary)', async () => {
    mockFfmpegFactory.mockImplementation(() =>
      makeChain((_folder, handlers) => {
        handlers.error?.(new Error('ffmpeg not found'));
      }),
    );

    const result = await generateThumbnailBuffers('/tmp/video.mp4');

    expect(result).toEqual([]);
  });
});

describe('bufferToDataUri', () => {
  it('encodes JPEG bytes as a base64 data URI', () => {
    expect(bufferToDataUri(Buffer.from('hello'))).toBe(
      `data:image/jpeg;base64,${Buffer.from('hello').toString('base64')}`,
    );
  });
});
