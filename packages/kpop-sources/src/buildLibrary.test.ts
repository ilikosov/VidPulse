import { describe, expect, it, vi } from 'vitest';
import { buildKpopLibrary } from './buildLibrary';
import type { FetchLike } from './types';

/**
 * Build a stub fetch that routes by query: the songs query (contains P175) gets
 * `songBindings`, everything else (the groups query) gets `groupBindings`.
 */
function stubFetch(groupBindings: unknown[], songBindings: unknown[] = []): FetchLike {
  return vi.fn(async (url: string) => {
    const bindings = decodeURIComponent(url).includes('wdt:P175') ? songBindings : groupBindings;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
      json: async () => ({ results: { bindings } }),
    };
  });
}

describe('buildKpopLibrary', () => {
  it('produces a merge snapshot with members and songs from the injected Wikidata response', async () => {
    const fetchImpl = stubFetch(
      [
        {
          group: { type: 'uri', value: 'http://www.wikidata.org/entity/Q24489' },
          groupEn: { type: 'literal', value: 'IVE', 'xml:lang': 'en' },
          groupKo: { type: 'literal', value: '아이브', 'xml:lang': 'ko' },
          typeClass: { type: 'uri', value: 'http://www.wikidata.org/entity/Q641066' },
          member: { type: 'uri', value: 'http://www.wikidata.org/entity/Q111' },
          memberEn: { type: 'literal', value: 'Wonyoung', 'xml:lang': 'en' },
          memberKo: { type: 'literal', value: '장원영', 'xml:lang': 'ko' },
        },
      ],
      [
        {
          group: { type: 'uri', value: 'http://www.wikidata.org/entity/Q24489' },
          song: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' },
          songEn: { type: 'literal', value: 'Love Dive', 'xml:lang': 'en' },
          songKo: { type: 'literal', value: '러브 다이브', 'xml:lang': 'ko' },
        },
      ],
    );

    const snapshot = await buildKpopLibrary({ userAgent: 'test-agent', fetchImpl });

    expect(snapshot.version).toBe(1);
    expect(snapshot.mode).toBe('merge');
    expect(snapshot.soloArtists).toEqual([]);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.groups).toHaveLength(1);
    expect(snapshot.groups[0]).toMatchObject({
      name: 'IVE',
      type: 'female',
      active: true,
      aliases: ['아이브'],
    });
    expect(snapshot.groups[0].artists?.[0].name).toBe('Wonyoung');
    expect(snapshot.groups[0].songs).toEqual([{ title: 'Love Dive', aliases: ['러브 다이브'] }]);
  });

  it('sends the descriptive User-Agent and both SPARQL queries in the requests', async () => {
    const fetchImpl = stubFetch([]);
    await buildKpopLibrary({ userAgent: 'VidPulse-KpopDB/1.0', fetchImpl, limit: 5 });

    expect(fetchImpl).toHaveBeenCalledTimes(2); // groups query + songs query
    const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls;
    const queries = calls.map(([url]) => decodeURIComponent(url as string));
    for (const q of queries) {
      expect(q).toContain('query.wikidata.org/sparql');
      expect(q).toContain('wd:Q213665'); // K-pop genre (bounded group set)
      expect(q).toContain('LIMIT 5');
    }
    expect(queries.some((q) => q.includes('wdt:P527'))).toBe(true); // groups: has-members
    expect(queries.some((q) => q.includes('wdt:P175'))).toBe(true); // songs: performer
    for (const [, init] of calls) {
      expect(init.headers['User-Agent']).toBe('VidPulse-KpopDB/1.0');
    }
  });
});
