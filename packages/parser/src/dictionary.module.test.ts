import { describe, expect, it, vi, beforeEach } from 'vitest';

// The DictionaryModule reads the dictionary_* tables directly through @vidpulse/db's knex (it no
// longer depends on the server's dictionary services). We mock knex with a tiny query-builder stub
// backed by a mutable in-memory dataset: each test seeds `data.*` and constructs a fresh module,
// which loads that snapshot. Only loadDictionary's queries are exercised here (module.parse()).
const { data, knexMock } = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const data = {
    groups: [] as Row[],
    artists: [] as Row[],
    songs: [] as Row[],
    events: [] as Row[],
    aliases: {
      group: [] as Row[],
      artist: [] as Row[],
      song: [] as Row[],
      event: [] as Row[],
    } as Record<string, Row[]>,
  };

  const knexMock: any = (tableExpr: string) => {
    const table = String(tableExpr).split(' ')[0];
    let entityType: string | null = null;
    const builder: any = {};
    const chain = () => builder;
    for (const m of [
      'select',
      'leftJoin',
      'join',
      'groupBy',
      'orderBy',
      'first',
      'pluck',
      'returning',
      'andWhere',
      'andWhereRaw',
      'whereRaw',
    ]) {
      builder[m] = chain;
    }
    builder.where = (col: unknown, val?: unknown) => {
      if (col === 'al.entity_type') entityType = String(val);
      return builder;
    };
    builder.then = (
      onFulfilled: (rows: Row[]) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => {
      let rows: Row[] = [];
      if (table === 'dictionary_groups') rows = data.groups;
      else if (table === 'dictionary_artists') rows = data.artists;
      else if (table === 'dictionary_songs') rows = data.songs;
      else if (table === 'dictionary_events') rows = data.events;
      else if (table === 'dictionary_aliases') rows = entityType ? data.aliases[entityType] : [];
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    };
    return builder;
  };
  knexMock.raw = (sql: string) => sql;

  return { data, knexMock };
});

vi.mock('@vidpulse/db', () => ({ knex: knexMock }));

import { DictionaryModule } from './dictionary.module';

describe('DictionaryModule aliases normalization', () => {
  beforeEach(() => {
    data.groups = [{ name: 'LE SSERAFIM' }, { name: 'ITZY' }];
    data.artists = [
      { name: 'YUNJIN', group_name: 'LE SSERAFIM' },
      { name: 'YUNA', group_name: 'ITZY' },
    ];
    data.songs = [{ title: 'DALLA DALLA', group_name: null }];
    data.events = [{ name: 'INKIGAYO' }];
    data.aliases.group = [
      { alias: '르세라핌', canonical: 'LE SSERAFIM' },
      { alias: '있지', canonical: 'ITZY' },
    ];
    data.aliases.artist = [
      { alias: '허윤진', canonical: 'YUNJIN' },
      { alias: '유나', canonical: 'YUNA' },
    ];
    data.aliases.song = [
      { alias: '달라달라', canonical: 'DALLA DALLA' },
      { alias: '유나', canonical: 'YUNA SONG' },
    ];
    data.aliases.event = [{ alias: '인기가요', canonical: 'INKIGAYO' }];
  });

  it('normalizes korean group and artist aliases from metadata fields', async () => {
    const module = new DictionaryModule();
    const result = await module.parse("르세라핌 허윤진 직캠 '1-800-hot-n-fun'", {
      group_name: '르세라핌',
      artist_name: '허윤진',
    });

    expect(result.metadata.group_name).toBe('LE SSERAFIM');
    expect(result.metadata.artist_name).toBe('YUNJIN');
  });

  it('normalizes 있지/유나 aliases to canonical names', async () => {
    const module = new DictionaryModule();
    const result = await module.parse("있지 유나 직캠 'DALLA DALLA'", {
      group_name: '있지',
      artist_name: '유나',
      song_title: '달라달라',
    });

    expect(result.metadata.group_name).toBe('ITZY');
    expect(result.metadata.artist_name).toBe('YUNA');
    expect(result.metadata.song_title).toBe('DALLA DALLA');
  });

  it('keeps aliases separated by entity type to avoid conflicts', async () => {
    const module = new DictionaryModule();
    const result = await module.parse('유나 stage', {
      artist_name: '유나',
      song_title: '유나',
    });

    expect(result.metadata.artist_name).toBe('YUNA');
    expect(result.metadata.song_title).toBe('YUNA SONG');
  });

  it('does not fuzzy-snap a new member onto a similar existing artist (GAWON ≠ Dawon)', async () => {
    // MEOVV's GAWON is not in the dictionary; the closest artist is "Dawon" (1 substitution,
    // similarity 0.8). A differing first letter must block the fuzzy match so the raw name stays.
    data.artists = [{ name: 'Dawon', group_name: 'SECRET NUMBER' }];

    const module = new DictionaryModule();
    const result = await module.parse("미야오 가원 'MEOW' (MEOVV GAWON FanCam)", {
      group_name: 'MEOVV',
      artist_name: 'GAWON',
    });

    expect(result.metadata.artist_name).toBe('GAWON');
  });

  it('still fuzzy-resolves a typo that keeps the first letter', async () => {
    // Guard only blocks differing first letters; a same-initial typo must still resolve.
    data.artists = [{ name: 'YUNA', group_name: 'ITZY' }];

    const module = new DictionaryModule();
    const result = await module.parse('stage', {
      artist_name: 'YUNAA', // trailing-letter typo, same first letter
    });

    expect(result.metadata.artist_name).toBe('YUNA');
  });

  it('matches a spaced dictionary name against a glued title token (MOONSUA → Moon Sua)', async () => {
    data.groups = [{ name: 'Billlie' }];
    data.artists = [{ name: 'Moon Sua', group_name: 'Billlie' }];

    const module = new DictionaryModule();
    // No group/artist pre-set: the dictionary must find them in the title. The credit has
    // "MOONSUA" (no space) but the dictionary stores "Moon Sua".
    const result = await module.parse("[4K CATCH CAM] Billlie MOONSUA 'RING X RING' 4K Fancam", {});

    expect(result.metadata.group_name).toBe('Billlie');
    expect(result.metadata.artist_name).toBe('Moon Sua');
  });

  it('picks the group credited at the start over one matched inside the trailing show name', async () => {
    // "Billlie" is the real group (early); "K-Pop" only matches inside the show "Simply K-Pop".
    // Ordered so the spurious group iterates first — only position awareness picks Billlie.
    data.groups = [{ name: 'K-Pop' }, { name: 'Billlie' }];
    data.artists = [{ name: 'Moon', group_name: 'Billlie' }];

    const module = new DictionaryModule();
    const result = await module.parse(
      "[플리캠 4K] Billlie MOON SUA 'song'(빌리 문수아 직캠) lSimply K-Pop CON-TOUR Ep.510",
      {},
    );

    expect(result.metadata.group_name).toBe('Billlie');
  });

  it('resolves event alias via dictionary aliases', async () => {
    const module = new DictionaryModule();
    const result = await module.parse('무대 @인기가요', {
      event: '@인기가요',
    });

    expect(result.metadata.event).toBe('INKIGAYO');
  });

  it('corrects an event with a doubled "@@" prefix via the hardcoded alias fallback', async () => {
    // Dictionary has no matching event (default seed only has 'INKIGAYO') — the hardcoded
    // eventAliasMap is the only path that can resolve "MUSIC CORE". A doubled "@@" prefix
    // (regex.module's raw output for a literal "@@EVENT" in the title) must not block it.
    const module = new DictionaryModule();
    const result = await module.parse('260523 Itzy Hwang Ye-ji - Motto @@MUSIC CORE', {
      event: '@@MUSIC CORE',
    });

    expect(result.metadata.event).toBe('MUSIC CORE');
  });

  it('resolves a doubled "@@" event exactly against the dictionary', async () => {
    data.events = [{ name: 'MUSICBANK' }];

    const module = new DictionaryModule();
    const result = await module.parse('260522 Itzy Hwang Ye-ji - Motto @@MUSICBANK', {
      event: '@@MUSICBANK',
    });

    expect(result.metadata.event).toBe('MUSICBANK');
  });

  it('normalizes an unresolved event to a single leading "@" instead of leaving it raw', async () => {
    const module = new DictionaryModule();
    const result = await module.parse('title', {
      event: '@@SOME UNKNOWN SHOW',
    });

    expect(result.metadata.event).toBe('SOME UNKNOWN SHOW');
  });

  it('resolves the artist within the identified group, not a look-alike elsewhere', async () => {
    // GAWON belongs to MEOVV; Dawon (SECRET NUMBER) is one substitution away. With the group
    // known, resolution is scoped to MEOVV's members so the look-alike is never considered.
    data.artists = [
      { name: 'Gawon', group_name: 'MEOVV' },
      { name: 'Dawon', group_name: 'SECRET NUMBER' },
    ];

    const module = new DictionaryModule();
    const result = await module.parse("미야오 가원 'MEOW' (MEOVV GAWON FanCam)", {
      group_name: 'MEOVV',
      artist_name: 'GAWON',
    });

    expect(result.metadata.artist_name).toBe('Gawon');
  });

  it('resolves a song within the identified group before the global catalogue', async () => {
    // Two same-spelled songs in different groups; the group context picks the right one.
    data.songs = [
      { title: 'TOUCH', group_name: 'MEOVV' },
      { title: 'TOUCH', group_name: 'STAYC' },
    ];
    data.groups = [{ name: 'MEOVV' }, { name: 'STAYC' }];
    data.artists = [{ name: 'Gawon', group_name: 'MEOVV' }];

    const module = new DictionaryModule();
    const result = await module.parse("미야오 'touch'", {
      group_name: 'MEOVV',
      song_title: 'touch',
    });

    expect(result.metadata.song_title).toBe('TOUCH');
  });

  it('scopes a title-extracted artist to the identified group when an alias is shared', async () => {
    // 예지 is the Korean alias of both ITZY's "Yeji" and the soloist "Yezi". The alias resolves
    // to "Yezi", and it appears before the English "YEJI" — so the earliest-position scan would
    // pick the look-alike. With ITZY identified, the in-group member must win.
    data.groups = [{ name: 'ITZY' }, { name: 'FIESTAR' }];
    data.artists = [
      { name: 'Yeji', group_name: 'ITZY' },
      { name: 'Yezi', group_name: 'FIESTAR' },
    ];
    data.aliases.group = [{ alias: '있지', canonical: 'ITZY' }];
    data.aliases.artist = [{ alias: '예지', canonical: 'Yezi' }]; // alias points at the look-alike

    const module = new DictionaryModule();
    const result = await module.parse("260213 예지 YEJI 있지 ITZY 'In My Pocket'", {});

    expect(result.metadata.group_name).toBe('ITZY');
    expect(result.metadata.artist_name).toBe('Yeji');
  });

  it('leaves the artist empty and flags review when the named member is absent from the group', async () => {
    // ITZY's "Yeji" is NOT in the dictionary; only the soloist "Yezi" (another group) carries the
    // shared Korean alias 예지. With ITZY identified, we must not snap onto the cross-group
    // look-alike — leave artist_name empty and flag the video for review instead.
    data.groups = [{ name: 'ITZY' }, { name: 'FIESTAR' }];
    data.artists = [{ name: 'Yezi', group_name: 'FIESTAR' }]; // no ITZY "Yeji" in the dictionary
    data.aliases.group = [{ alias: '있지', canonical: 'ITZY' }];
    data.aliases.artist = [{ alias: '예지', canonical: 'Yezi' }];

    const module = new DictionaryModule();
    const result = await module.parse("260215 있지 예지 ITZY YEJI 'In My Pocket'", {});

    expect(result.metadata.group_name).toBe('ITZY');
    expect(result.metadata.artist_name).toBeUndefined();
    expect(result.metadata.unresolved_artist).toBe(true);
  });

  it('falls back to the global artist list when the group lacks a match', async () => {
    // A guest/cover whose name is not a member of the identified group still resolves globally.
    data.artists = [
      { name: 'YUNA', group_name: 'ITZY' },
      { name: 'Gawon', group_name: 'MEOVV' },
    ];

    const module = new DictionaryModule();
    const result = await module.parse('stage', {
      group_name: 'MEOVV', // YUNA is not a MEOVV member → scoped miss → global match
      artist_name: '유나',
    });

    expect(result.metadata.artist_name).toBe('YUNA');
  });
});
