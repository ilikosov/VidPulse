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

const state = {
  videos: [
    { id: 1, duration_seconds: 89 },
    { id: 2, duration_seconds: 90 },
  ],
  tagged: new Set<number>(),
};

vi.mock('../services/tag.service', () => ({
  LEGACY_SHORT_TAG: 'short',
  SHORTS_TAG: 'shorts',
  LONG_VIDEO_TAG: 'длинное видео',
  assignAutoTags: vi.fn(),
  mergeShortTags: vi.fn(),
  tagLongVideosByDuration: vi.fn(),
  tagShortsByDuration: vi.fn(async () => {
    const checked = state.videos.filter((v) => v.duration_seconds !== null).length;
    const eligibleIds = state.videos.filter((v) => v.duration_seconds < 90).map((v) => v.id);
    let tagged = 0;
    for (const id of eligibleIds) {
      if (!state.tagged.has(id)) {
        state.tagged.add(id);
        tagged++;
      }
    }
    return {
      checked,
      eligible: eligibleIds.length,
      tagged,
      alreadyTagged: eligibleIds.length - tagged,
    };
  }),
}));

describe('POST /api/videos/batch/tag-shorts-by-duration', async () => {
  const { default: router } = await import('./video.routes');

  beforeEach(() => {
    state.tagged.clear();
    delete process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED;
  });

  it('returns 403 when dangerous actions are disabled', async () => {
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/videos/batch/tag-shorts-by-duration`, {
      method: 'POST',
    });
    const body = await res.json();
    server.close();

    expect(res.status).toBe(403);
    expect(body.error).toContain('disabled');
  });

  it('tags shorts for duration 89, not for 90, and avoids duplicates on repeated call', async () => {
    process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED = 'true';
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const firstRes = await fetch(
      `http://127.0.0.1:${port}/api/videos/batch/tag-shorts-by-duration`,
      {
        method: 'POST',
      },
    );
    const firstBody = await firstRes.json();

    const secondRes = await fetch(
      `http://127.0.0.1:${port}/api/videos/batch/tag-shorts-by-duration`,
      {
        method: 'POST',
      },
    );
    const secondBody = await secondRes.json();
    server.close();

    expect(firstRes.status).toBe(200);
    expect(firstBody).toEqual({ checked: 2, eligible: 1, tagged: 1, alreadyTagged: 0 });
    expect(state.tagged.has(1)).toBe(true);
    expect(state.tagged.has(2)).toBe(false);

    expect(secondRes.status).toBe(200);
    expect(secondBody).toEqual({ checked: 2, eligible: 1, tagged: 0, alreadyTagged: 1 });
  });
});
