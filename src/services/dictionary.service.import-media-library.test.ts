import { describe, expect, it, vi } from 'vitest';

const { state, mockedKnex } = vi.hoisted(() => {
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

  return { state: db, mockedKnex: knexMock };
});

vi.mock('../db', () => ({ default: mockedKnex }));

import { DictionaryService } from './dictionary.service';

describe('DictionaryService.importMediaLibrary', () => {
  it('imports group -> artist -> song and creates membership without KnexTimeoutError', async () => {
    const service = new DictionaryService();

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
    expect(state.dictionary_artist_memberships).toHaveLength(1);
    expect(state.dictionary_artist_memberships[0]).toMatchObject({
      activity_type: 'group',
      status: 'active',
      is_primary: true,
    });
  });
});
