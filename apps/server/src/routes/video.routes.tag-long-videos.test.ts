import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';

vi.mock('../db', () => ({ default: vi.fn(() => ({})) }));
vi.mock('../models/videoStatus', () => ({ VALID_STATUSES: ['new'], isValidStatus: () => true }));
vi.mock('../services/parser/parser.service', () => ({ parseTitle: vi.fn() }));
vi.mock('../services/parser/metadataResolver.service', () => ({
  hasUnresolvedEntity: vi.fn(() => false),
  resolveParsedMetadata: vi.fn(),
}));
vi.mock('../services/youtube.service', () => ({ youtubeService: {} }));
vi.mock('../services/eventLog.service', () => ({ logEvent: vi.fn() }));
vi.mock('../services/ai.service', () => ({ parseTitleWithLLM: vi.fn() }));

vi.mock('../services/tag.service', () => ({
  LEGACY_SHORT_TAG: 'short',
  SHORTS_TAG: 'shorts',
  LONG_VIDEO_TAG: 'длинное видео',
  assignAutoTags: vi.fn(),
  tagShortsByDuration: vi.fn(),
  mergeShortTags: vi.fn(),
  tagLongVideosByDuration: vi.fn(async () => ({
    checked: 10,
    eligible: 3,
    tagged: 2,
    alreadyTagged: 1,
  })),
}));

describe('POST /api/videos/batch/tag-long-videos-by-duration', async () => {
  const { default: router } = await import('./video');

  beforeEach(() => {
    delete process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED;
  });

  it('returns 403 when dangerous actions are disabled', async () => {
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const res = await fetch(
      `http://127.0.0.1:${port}/api/videos/batch/tag-long-videos-by-duration`,
      { method: 'POST' },
    );
    server.close();
    expect(res.status).toBe(403);
  });

  it('returns summary when dangerous actions are enabled', async () => {
    process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED = 'true';
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const res = await fetch(
      `http://127.0.0.1:${port}/api/videos/batch/tag-long-videos-by-duration`,
      { method: 'POST' },
    );
    const body = await res.json();
    server.close();

    expect(res.status).toBe(200);
    expect(body).toEqual({ checked: 10, eligible: 3, tagged: 2, alreadyTagged: 1 });
  });
});
