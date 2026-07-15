import { describe, expect, it, vi } from 'vitest';
import { ingestVideo } from './ingestVideo';
import type { IngestDeps } from './ingestVideo';

// Unit test with injected deps + mocked metadata.utils. Regression coverage for the hardcoded
// status bug: ingestVideo used to insert every new video as 'needs_review', discarding the
// status parseVideoMetadata computed — so cleanly-parsed channel-sync videos skipped 'new'.

const { mockParseVideoMetadata } = vi.hoisted(() => ({ mockParseVideoMetadata: vi.fn() }));
vi.mock('./metadata.utils', () => ({ parseVideoMetadata: mockParseVideoMetadata }));

const { mockSyncVideoSongs } = vi.hoisted(() => ({ mockSyncVideoSongs: vi.fn() }));
vi.mock('../videoSongs.service', () => ({ syncVideoSongs: mockSyncVideoSongs }));

function makeDeps(insert: ReturnType<typeof vi.fn>): IngestDeps {
  return {
    videos: {
      findByYoutubeId: vi.fn().mockResolvedValue(null),
      insert,
    } as unknown as IngestDeps['videos'],
    youtube: {
      getVideoDetails: vi.fn().mockResolvedValue({
        title: 'test title',
        publishedAt: '2026-01-01T00:00:00.000Z',
        durationSeconds: 200,
      }),
    } as unknown as IngestDeps['youtube'],
    parser: {} as IngestDeps['parser'],
    tags: { assignAutoTags: vi.fn() } as unknown as IngestDeps['tags'],
  };
}

describe('ingestVideo status', () => {
  it.each(['new', 'needs_review'] as const)(
    "inserts with the parser-computed status '%s' instead of hardcoding needs_review",
    async (status) => {
      mockParseVideoMetadata.mockResolvedValue({
        metadata: { group_name: 'G' },
        status,
        songTitle: undefined,
        songTitles: undefined,
      });
      const insert = vi.fn().mockResolvedValue(1);

      await ingestVideo(makeDeps(insert), { videoId: 'abc123def45', title: 't' }, {});

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status }));
    },
  );
});
