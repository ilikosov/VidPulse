import { describe, expect, it, vi } from 'vitest';
import { buildKpopLibrary } from './buildLibrary';
import type { FetchLike } from './types';

/** Build a stub fetch that returns the given SPARQL bindings as a JSON response. */
function stubFetch(bindings: unknown[]): FetchLike {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '',
    json: async () => ({ results: { bindings } }),
  }));
}

describe('buildKpopLibrary', () => {
  it('produces a merge snapshot from the injected Wikidata response', async () => {
    const fetchImpl = stubFetch([
      {
        group: { type: 'uri', value: 'http://www.wikidata.org/entity/Q24489' },
        groupEn: { type: 'literal', value: 'IVE', 'xml:lang': 'en' },
        groupKo: { type: 'literal', value: '아이브', 'xml:lang': 'ko' },
        typeClass: { type: 'uri', value: 'http://www.wikidata.org/entity/Q641066' },
        member: { type: 'uri', value: 'http://www.wikidata.org/entity/Q111' },
        memberEn: { type: 'literal', value: 'Wonyoung', 'xml:lang': 'en' },
        memberKo: { type: 'literal', value: '장원영', 'xml:lang': 'ko' },
      },
    ]);

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
  });

  it('sends the descriptive User-Agent and SPARQL query in the request', async () => {
    const fetchImpl = stubFetch([]);
    await buildKpopLibrary({ userAgent: 'VidPulse-KpopDB/1.0', fetchImpl, limit: 5 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('query.wikidata.org/sparql');
    expect(decodeURIComponent(url)).toContain('wd:Q213665'); // K-pop genre
    expect(decodeURIComponent(url)).toContain('LIMIT 5');
    expect(init.headers['User-Agent']).toBe('VidPulse-KpopDB/1.0');
  });
});
