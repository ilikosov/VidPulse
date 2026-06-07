import { beforeEach, describe, expect, it, vi } from 'vitest';

const tables = {
  dictionary_groups: [{ id: 1, name: 'LE SSERAFIM', type: 'female', active: true }],
  dictionary_artists: [{ id: 10, name: 'YUNJIN', group_id: 1 }],
  dictionary_songs: [{ id: 20, title: 'DALLA DALLA', artist: 'ITZY' }],
  dictionary_aliases: [] as Array<{ entity_type: string; entity_id: number; alias: string }>,
};

function createQuery(tableName: keyof typeof tables) {
  const state: { filters: Record<string, unknown>; raw: Array<{ field: string; value: string }> } =
    {
      filters: {},
      raw: [],
    };

  const builder = {
    where(filter: Record<string, unknown>) {
      state.filters = { ...state.filters, ...filter };
      return builder;
    },
    whereRaw(_sql: string, values: unknown[]) {
      const field = _sql.includes('LOWER(name)')
        ? 'name'
        : _sql.includes('LOWER(title)')
          ? 'title'
          : 'alias';
      state.raw.push({ field, value: String(values[0]) });
      return builder;
    },
    andWhereRaw(sql: string, values: unknown[]) {
      return builder.whereRaw(sql, values);
    },
    async first() {
      return (tables[tableName] as any[]).find((row) => {
        const exact = Object.entries(state.filters).every(([k, v]) => row[k] === v);
        const raw = state.raw.every(
          ({ field, value }) => String(row[field] ?? '').toLowerCase() === value,
        );
        return exact && raw;
      });
    },
    async insert(payload: any) {
      (tables[tableName] as any[]).push(payload);
      return [1];
    },
  };
  return builder;
}

vi.mock('../db', () => ({
  default: ((tableName: keyof typeof tables) => createQuery(tableName)) as any,
}));

import { MediaLibraryService } from './dictionary';

describe('DictionaryService.importRecords aliases support', () => {
  beforeEach(() => {
    tables.dictionary_aliases.length = 0;
  });

  it('imports aliases by canonical entity name and prevents case-insensitive duplicates', async () => {
    const service = new MediaLibraryService();
    const summary = await service.importRecords([
      { type: 'aliases', entity_type: 'group', entity_name: 'le sserafim', alias: '르세라핌' },
      { type: 'aliases', entity_type: 'group', entity_name: 'LE SSERAFIM', alias: '르세라핌' },
      { type: 'aliases', entity_type: 'artist', entity_name: 'YUNJIN', alias: '허윤진' },
      { type: 'aliases', entity_type: 'song', entity_name: 'DALLA DALLA', alias: '달라달라' },
    ]);

    expect(summary.errors).toEqual([]);
    expect(summary.inserted).toBe(3);
    expect(summary.updated).toBe(1);
    expect(tables.dictionary_aliases).toEqual([
      { entity_type: 'group', entity_id: 1, alias: '르세라핌' },
      { entity_type: 'artist', entity_id: 10, alias: '허윤진' },
      { entity_type: 'song', entity_id: 20, alias: '달라달라' },
    ]);
  });
});
