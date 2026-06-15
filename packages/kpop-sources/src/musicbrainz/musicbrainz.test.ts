import { describe, expect, it, vi } from 'vitest';
import { fetchRecordingsByArtist } from './client';
import { normalizeRecordings } from './normalize';
import { musicBrainzSource } from './musicbrainz.source';
import { fetchJson } from '../http';
import type { EnrichableGroup, FetchLike, SourceOptions } from '../types';

function errorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    statusText: 'Service Unavailable',
    text: async () => body,
    json: async () => ({}),
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '',
    json: async () => body,
  };
}

const baseOpts = (over: Partial<SourceOptions> = {}): SourceOptions => ({
  userAgent: 'test-agent',
  ...over,
});

describe('normalizeRecordings', () => {
  it('dedupes recordings case-insensitively by title and skips blank titles', () => {
    const songs = normalizeRecordings([
      { title: 'Untouchable' },
      { title: 'untouchable' }, // case-dup
      { title: '   ' }, // blank
      { title: 'Born to Be' },
      {}, // no title
    ]);
    expect(songs).toEqual([
      { title: 'Untouchable', aliases: [] },
      { title: 'Born to Be', aliases: [] },
    ]);
  });
});

describe('fetchRecordingsByArtist', () => {
  it('paginates until recording-count is exhausted', async () => {
    const page1 = {
      'recording-count': 150,
      recordings: Array.from({ length: 100 }, (_, i) => ({ title: `T${i}` })),
    };
    const page2 = {
      'recording-count': 150,
      recordings: Array.from({ length: 50 }, (_, i) => ({ title: `T${100 + i}` })),
    };
    const fetchImpl: FetchLike = vi.fn(async (url: string) =>
      jsonResponse(url.includes('offset=0') ? page1 : page2),
    );

    const recs = await fetchRecordingsByArtist('mbid-1', {
      userAgent: 'ua',
      fetchImpl,
      rateLimitMs: 0,
    });

    expect(recs).toHaveLength(150);
    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });
});

describe('MusicBrainzSource.enrich', () => {
  it('merges MusicBrainz titles into group songs, deduping against existing', async () => {
    const groups: EnrichableGroup[] = [
      { name: 'ITZY', mbid: 'itzy-mbid', songs: [{ title: 'Born to Be', aliases: [] }] },
    ];
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse({
        'recording-count': 2,
        recordings: [{ title: 'Born to Be' }, { title: 'Untouchable' }],
      }),
    );

    await musicBrainzSource.enrich(
      groups,
      baseOpts({ fetchImpl, musicBrainz: { enabled: true, rateLimitMs: 0 } }),
    );

    // 'Born to Be' is deduped against the Wikidata song; only 'Untouchable' is added.
    expect(groups[0].songs?.map((s) => s.title)).toEqual(['Born to Be', 'Untouchable']);
  });

  it('does nothing when disabled or when a group has no mbid', async () => {
    const fetchImpl = vi.fn();
    const groups: EnrichableGroup[] = [{ name: 'NoMbid' }];

    await musicBrainzSource.enrich(
      groups,
      baseOpts({ fetchImpl: fetchImpl as unknown as FetchLike, musicBrainz: { enabled: false } }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();

    await musicBrainzSource.enrich(
      groups,
      baseOpts({
        fetchImpl: fetchImpl as unknown as FetchLike,
        musicBrainz: { enabled: true, rateLimitMs: 0 },
      }),
    );
    expect(fetchImpl).not.toHaveBeenCalled(); // skipped: no mbid bridge
  });

  it('logs a readable reason (not "{}") and counts failures', async () => {
    vi.useFakeTimers();
    try {
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const fetchImpl: FetchLike = vi.fn(async () => errorResponse(503, 'rate limited'));
      const groups: EnrichableGroup[] = [{ name: 'ITZY', mbid: 'itzy-mbid' }];

      const promise = musicBrainzSource.enrich(
        groups,
        baseOpts({ fetchImpl, logger, musicBrainz: { enabled: true, rateLimitMs: 0 } }),
      );
      await vi.runAllTimersAsync(); // flush retry backoff sleeps
      await promise;

      const warned = logger.warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(warned).toContain('ITZY');
      expect(warned).toContain('HTTP 503');
      expect(warned).not.toContain('{}');
      const info = logger.info.mock.calls.map((c) => String(c[0])).join('\n');
      expect(info).toContain('1 failed');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fetchJson error reporting', () => {
  it('includes the response body in the thrown error on 5xx', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl: FetchLike = vi.fn(async () => errorResponse(503, 'too many requests'));
      const promise = fetchJson('http://example.test', { userAgent: 'ua', fetchImpl, retries: 1 });
      const assertion = expect(promise).rejects.toThrow('too many requests');
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a clear timeout (not an opaque abort) when the request times out', async () => {
    vi.useFakeTimers();
    try {
      // Never resolves; only rejects when our timeout aborts the request signal.
      const fetchImpl: FetchLike = vi.fn(
        (_url, init) =>
          new Promise<never>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('This operation was aborted')),
            );
          }),
      );
      const promise = fetchJson('http://example.test', {
        userAgent: 'ua',
        fetchImpl,
        retries: 0,
        timeoutMs: 5000,
      });
      const assertion = expect(promise).rejects.toThrow('request timed out after 5000ms');
      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
