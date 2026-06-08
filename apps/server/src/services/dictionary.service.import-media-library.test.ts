import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, mockedKnex, ids } = vi.hoisted(() => {
  type Row = Record<string, any>;
  const db = {
    dictionary_groups: [] as Row[],
    dictionary_artists: [] as Row[],
    dictionary_songs: [] as Row[],
    dictionary_events: [] as Row[],
    dictionary_aliases: [] as Row[],
    dictionary_artist_memberships: [] as Row[],
    dictionary_song_artists: [] as Row[],
    dictionary_song_groups: [] as Row[],
  };

  let inTransaction = false;
  const ids: Record<string, number> = {
    dictionary_groups: 0,
    dictionary_artists: 0,
    dictionary_songs: 0,
    dictionary_events: 0,
    dictionary_artist_memberships: 0,
  };

  const now = () => '2026-05-15T00:00:00.000Z';

  function createBuilder(tableName: keyof typeof db, fromTrx: boolean) {
    if (!fromTrx && inTransaction && tableName === 'dictionary_artist_memberships') {
      throw new Error(
        'KnexTimeoutError: Timeout acquiring a connection. Are you missing a .transacting(trx) call?',
      );
    }

    const filters: Array<(row: Row) => boolean> = [];
    const builder: any = {
      where(filter: Record<string, unknown> | ((qb: any) => void)) {
        if (typeof filter === 'function') {
          const nested: Array<(row: Row) => boolean> = [];
          const qb = {
            where(data: Record<string, unknown>) {
              nested.push((row) => Object.entries(data).every(([k, v]) => row[k] === v));
              return qb;
            },
            whereNull(field: string) {
              nested.push((row) => row[field] == null);
              return qb;
            },
          };
          filter(qb);
          filters.push((row) => nested.every((fn) => fn(row)));
        } else {
          filters.push((row) => Object.entries(filter).every(([k, v]) => row[k] === v));
        }
        return builder;
      },
      whereRaw(sql: string, values: unknown[]) {
        if (sql.includes('LOWER(name)')) {
          const v = String(values[0]);
          filters.push((row) => String(row.name || '').toLowerCase() === v);
        } else if (sql.includes('LOWER(title)')) {
          const v = String(values[0]);
          filters.push((row) => String(row.title || '').toLowerCase() === v);
        }
        return builder;
      },
      andWhereRaw(sql: string, values: unknown[]) {
        if (sql.includes('LOWER(alias)')) {
          const v = String(values[0]);
          filters.push((row) => String(row.alias || '').toLowerCase() === v);
        }
        return builder;
      },
      whereNull(field: string) {
        filters.push((row) => row[field] == null);
        return builder;
      },
      async first() {
        return db[tableName].find((row) => filters.every((f) => f(row)));
      },
      insert(payload: Row) {
        const row = { ...payload };
        if (tableName === 'dictionary_song_artists') {
          const exists = db.dictionary_song_artists.some(
            (item) => item.song_id === row.song_id && item.artist_id === row.artist_id,
          );
          if (exists) {
            (builder as any)._lastInsertId = undefined;
            return builder;
          }
        }
        if (tableName === 'dictionary_song_groups') {
          const exists = db.dictionary_song_groups.some(
            (item) => item.song_id === row.song_id && item.group_id === row.group_id,
          );
          if (exists) {
            (builder as any)._lastInsertId = undefined;
            return builder;
          }
        }
        if (row.id == null && ids[tableName] != null) {
          ids[tableName] += 1;
          row.id = ids[tableName];
        }
        db[tableName].push(row);
        (builder as any)._lastInsertId = row.id ?? 1;
        return builder;
      },
      async update(patch: Row) {
        const target = db[tableName].find((row) => filters.every((f) => f(row)));
        if (target) Object.assign(target, patch);
        return 1;
      },
      onConflict() {
        return {
          ignore: async () => undefined,
        };
      },
      then(resolve: (value: any) => any) {
        return Promise.resolve([(builder as any)._lastInsertId ?? 1]).then(resolve);
      },
    };

    return builder;
  }

  const knexMock: any = ((tableName: keyof typeof db) => createBuilder(tableName, false)) as any;
  knexMock.fn = { now };
  knexMock.transaction = async (fn: (trx: any) => Promise<void>) => {
    inTransaction = true;
    const trx: any = (tableName: keyof typeof db) => createBuilder(tableName, true);
    trx.fn = { now };
    try {
      await fn(trx);
    } finally {
      inTransaction = false;
    }
  };

  return { state: db, mockedKnex: knexMock, ids };
});

vi.mock('../db', () => ({ default: mockedKnex }));

import { MediaLibraryService } from './dictionary';

describe('DictionaryService.importMediaLibrary', () => {
  beforeEach(() => {
    state.dictionary_groups.length = 0;
    state.dictionary_artists.length = 0;
    state.dictionary_songs.length = 0;
    state.dictionary_events.length = 0;
    state.dictionary_aliases.length = 0;
    state.dictionary_artist_memberships.length = 0;
    state.dictionary_song_artists.length = 0;
    state.dictionary_song_groups.length = 0;
    ids.dictionary_groups = 0;
    ids.dictionary_artists = 0;
    ids.dictionary_songs = 0;
    ids.dictionary_events = 0;
    ids.dictionary_artist_memberships = 0;
  });
  it('imports group-level songs and creates song-group links', async () => {
    const service = new MediaLibraryService();
    await service.importMediaLibrary({
      mode: 'merge',
      groups: [{ name: 'ITZY', type: 'female', songs: [{ title: 'LOCO' }] }],
    });

    expect(state.dictionary_songs).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'LOCO', artist: 'ITZY' })]),
    );
    expect(state.dictionary_song_groups).toEqual(
      expect.arrayContaining([expect.objectContaining({ group_id: 1 })]),
    );
  });

  it('imports solo artist songs and creates song-artist links', async () => {
    const service = new MediaLibraryService();
    await service.importMediaLibrary({
      mode: 'merge',
      soloArtists: [{ name: 'IU', songs: [{ title: 'Palette' }] }],
    });

    expect(state.dictionary_songs).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Palette', artist: 'IU' })]),
    );
    expect(state.dictionary_song_artists).toEqual(
      expect.arrayContaining([expect.objectContaining({ artist_id: 1 })]),
    );
  });

  it('imports group -> artist -> song and creates membership without KnexTimeoutError', async () => {
    const service = new MediaLibraryService();

    const result = await service.importMediaLibrary({
      mode: 'merge',
      groups: [
        {
          name: 'ITZY',
          type: 'female',
          artists: [
            {
              name: 'YEJI',
              membership: { status: 'active', isPrimary: true },
              songs: [{ title: 'WANNABE' }],
            },
          ],
        },
      ],
    });

    expect(result.errors).toEqual([]);
    expect(state.dictionary_song_artists).toEqual(
      expect.arrayContaining([expect.objectContaining({ song_id: 1, artist_id: 1 })]),
    );
    expect(state.dictionary_song_groups).toEqual(
      expect.arrayContaining([expect.objectContaining({ song_id: 1, group_id: 1 })]),
    );
    expect(state.dictionary_artist_memberships).toHaveLength(1);
    expect(state.dictionary_artist_memberships[0]).toMatchObject({
      activity_type: 'group',
      status: 'active',
      is_primary: true,
    });
  });

  it('imports song aliases and avoids duplicates on repeated import', async () => {
    const service = new MediaLibraryService();
    const payload = {
      mode: 'merge',
      groups: [
        {
          name: 'BLACKPINK',
          type: 'female',
          artists: [{ name: 'JENNIE', songs: [{ title: 'SOLO', aliases: ['솔로', 'solo'] }] }],
          songs: [{ title: 'Shut Down', aliases: ['셧다운'] }],
        },
      ],
      soloArtists: [{ name: 'TAEYEON', songs: [{ title: 'INVU', aliases: ['아이엔비유'] }] }],
    };

    await service.importMediaLibrary(payload);
    await service.importMediaLibrary(payload);

    expect(state.dictionary_songs.filter((s) => s.title === 'SOLO')).toHaveLength(1);
    expect(state.dictionary_songs.filter((s) => s.title === 'Shut Down')).toHaveLength(1);
    expect(state.dictionary_songs.filter((s) => s.title === 'INVU')).toHaveLength(1);

    expect(
      state.dictionary_song_artists.filter((row) => row.song_id === 1 && row.artist_id === 1),
    ).toHaveLength(1);
    expect(
      state.dictionary_song_groups.filter((row) => row.song_id === 1 && row.group_id === 1),
    ).toHaveLength(1);
    expect(
      state.dictionary_song_groups.filter((row) => row.song_id === 2 && row.group_id === 1),
    ).toHaveLength(1);

    expect(
      state.dictionary_aliases.filter((a) => a.entity_type === 'song' && a.entity_id === 1),
    ).toHaveLength(1);
    expect(
      state.dictionary_aliases.filter((a) => a.entity_type === 'song' && a.entity_id === 2),
    ).toHaveLength(1);
  });

  it('imports aliases for group, artist, song and event and skips invalid aliases', async () => {
    const service = new MediaLibraryService();
    const payload = {
      version: 1,
      mode: 'merge',
      groups: [
        {
          name: 'AESPA',
          type: 'female',
          aliases: ['에스파', 'AESPA', '   '],
          artists: [
            {
              name: 'KARINA',
              aliases: ['카리나', 'KARINA'],
              membership: { activityType: 'group', status: 'active' },
              songs: [{ title: 'Next Level', aliases: ['넥스트 레벨', 'Next   Level'] }],
            },
          ],
        },
      ],
      events: [{ name: 'KYUNGIL UNIVERSITY FESTIVAL', aliases: ['경일대 축제'] }],
    };

    const firstImport = await service.importMediaLibrary(payload);
    const secondImport = await service.importMediaLibrary(payload);

    expect(firstImport.groups.aliasesInserted).toBe(1);
    expect(firstImport.artists.aliasesInserted).toBe(1);
    expect(firstImport.songs.aliasesInserted).toBe(1);
    expect(firstImport.events.aliasesInserted).toBe(1);
    expect(secondImport.groups.aliasesInserted).toBe(0);
    expect(secondImport.artists.aliasesInserted).toBe(0);
    expect(secondImport.songs.aliasesInserted).toBe(0);
    expect(secondImport.events.aliasesInserted).toBe(0);

    expect(
      state.dictionary_aliases.filter(
        (a) => a.entity_type === 'group' && a.entity_id === 1 && a.alias === '에스파',
      ),
    ).toHaveLength(1);
    expect(
      state.dictionary_aliases.filter(
        (a) => a.entity_type === 'artist' && a.entity_id === 1 && a.alias === '카리나',
      ),
    ).toHaveLength(1);
    expect(
      state.dictionary_aliases.filter(
        (a) => a.entity_type === 'song' && a.entity_id === 1 && a.alias === '넥스트 레벨',
      ),
    ).toHaveLength(1);
    expect(
      state.dictionary_aliases.filter(
        (a) => a.entity_type === 'event' && a.entity_id === 1 && a.alias === '경일대 축제',
      ),
    ).toHaveLength(1);
  });

  it('imports media-library json end-to-end with nested aliases', async () => {
    const service = new MediaLibraryService();
    await service.importMediaLibrary({
      version: 1,
      mode: 'merge',
      groups: [
        {
          name: 'AESPA',
          type: 'female',
          aliases: ['에스파'],
          artists: [
            {
              name: 'KARINA',
              aliases: ['카리나'],
              membership: { activityType: 'group', status: 'active' },
              songs: [{ title: 'Dark Arts', aliases: ['다크 아츠'] }],
            },
          ],
        },
      ],
      events: [
        {
          name: 'PUBG NATIONS CUP 2025 - FINAL STAGE',
          aliases: ['펍지 네이션스 컵 2025'],
        },
      ],
    });

    expect(state.dictionary_aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity_type: 'group', alias: '에스파' }),
        expect.objectContaining({ entity_type: 'artist', alias: '카리나' }),
        expect.objectContaining({ entity_type: 'song', alias: '다크 아츠' }),
        expect.objectContaining({ entity_type: 'event', alias: '펍지 네이션스 컵 2025' }),
      ]),
    );
  });
});
