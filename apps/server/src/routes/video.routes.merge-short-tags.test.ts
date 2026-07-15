import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';

vi.mock('@vidpulse/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vidpulse/db')>()),
  knex: vi.fn(() => ({})),
}));
vi.mock('../models/videoStatus', () => ({ VALID_STATUSES: ['new'], isValidStatus: () => true }));
vi.mock('../services/parseTitle', () => ({ parseTitle: vi.fn() }));
vi.mock('../services/metadataResolver.service', () => ({
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
  tagLongVideosByDuration: vi.fn(),
  mergeShortTags: vi.fn(async () => ({
    shortsTagId: 2,
    legacyShortTagId: 1,
    moved: 5,
    removedLegacyTag: true,
  })),
}));

describe('POST /api/videos/batch/merge-short-tags', async () => {
  const { default: router } = await import('./video');

  beforeEach(() => {
    delete process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED;
  });

  it('returns 403 when dangerous actions are disabled', async () => {
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/videos/batch/merge-short-tags`, {
      method: 'POST',
    });
    server.close();
    expect(res.status).toBe(403);
  });

  it('returns summary when dangerous actions are enabled', async () => {
    process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED = 'true';
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/videos/batch/merge-short-tags`, {
      method: 'POST',
    });
    const body = await res.json();
    server.close();

    expect(res.status).toBe(200);
    expect(body).toEqual({ shortsTagId: 2, legacyShortTagId: 1, moved: 5, removedLegacyTag: true });
  });
});
