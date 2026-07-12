import { describe, expect, it, vi } from 'vitest';

const { mockFfprobe } = vi.hoisted(() => ({ mockFfprobe: vi.fn() }));

vi.mock('fluent-ffmpeg', () => ({
  default: { ffprobe: mockFfprobe },
}));

import { probeDimensions } from './file-probe.service';

describe('probeDimensions', () => {
  it('resolves the video stream dimensions', async () => {
    mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, data: unknown) => void) => {
      cb(null, {
        streams: [
          { codec_type: 'audio', index: 0 },
          { codec_type: 'video', index: 1, width: 1080, height: 1920 },
        ],
      });
    });

    await expect(probeDimensions('/tmp/video.mp4')).resolves.toEqual({ width: 1080, height: 1920 });
  });

  it('resolves null when ffprobe errors (e.g. missing binary or corrupt file)', async () => {
    mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, data: unknown) => void) => {
      cb(new Error('ffprobe not found'), undefined);
    });

    await expect(probeDimensions('/tmp/video.mp4')).resolves.toBeNull();
  });

  it('resolves null when there is no video stream', async () => {
    mockFfprobe.mockImplementation((_path: string, cb: (err: unknown, data: unknown) => void) => {
      cb(null, { streams: [{ codec_type: 'audio', index: 0 }] });
    });

    await expect(probeDimensions('/tmp/audio-only.mp4')).resolves.toBeNull();
  });
});
