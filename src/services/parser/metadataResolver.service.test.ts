import { beforeEach, describe, expect, it, vi } from 'vitest';

const tables = {
  dictionary_groups: [{ id: 1, name: 'LE SSERAFIM' }],
  dictionary_artists: [{ id: 10, name: 'YUNJIN' }],
  dictionary_songs: [{ id: 20, title: 'DALLA DALLA' }],
  dictionary_events: [{ id: 30, name: 'INKIGAYO' }],
  dictionary_aliases: [
    { entity_type: 'group', entity_id: 1, alias: '르세라핌' },
    { entity_type: 'artist', entity_id: 10, alias: '허윤진' },
    { entity_type: 'song', entity_id: 20, alias: '달라달라' },
    { entity_type: 'event', entity_id: 30, alias: '@sbs inkigayo' },
  ],
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeEvent(value: string): string {
  return normalize(value.replace(/^@+/, ''));
}

function createQuery(tableName: keyof typeof tables) {
  const state: { filters: Record<string, unknown>; raw: Array<{ field: string; value: string }> } =
    {
      filters: {},
      raw: [],
    };

  const builder = {
    select() {
      return builder;
    },
    where(filter: Record<string, unknown>) {
      state.filters = { ...state.filters, ...filter };
      return builder;
    },
    whereRaw(sql: string, values: unknown[]) {
      if (sql.includes("REPLACE(name, '@', '')")) {
        state.raw.push({ field: 'event_name', value: String(values[0]) });
      } else if (sql.includes("REPLACE(alias, '@', '')")) {
        state.raw.push({ field: 'event_alias', value: String(values[0]) });
      } else if (sql.includes('LOWER(name)')) {
        state.raw.push({ field: 'name', value: String(values[0]) });
      } else if (sql.includes('LOWER(title)')) {
        state.raw.push({ field: 'title', value: String(values[0]) });
      } else {
        state.raw.push({ field: 'alias', value: String(values[0]) });
      }
      return builder;
    },
    async first() {
      return (tables[tableName] as any[]).find((row) => {
        const exact = Object.entries(state.filters).every(([k, v]) => row[k] === v);
        const raw = state.raw.every(({ field, value }) => {
          if (field === 'event_name') return normalizeEvent(String(row.name ?? '')) === value;
          if (field === 'event_alias') return normalizeEvent(String(row.alias ?? '')) === value;
          return normalize(String(row[field] ?? '')) === value;
        });
        return exact && raw;
      });
    },
  };

  return builder;
}

vi.mock('../../db', () => ({
  default: ((tableName: keyof typeof tables) => createQuery(tableName)) as any,
}));

import { resolveParsedMetadata } from './metadataResolver.service';

describe('resolveParsedMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves exact canonical names to ids and canonical values', async () => {
    const resolved = await resolveParsedMetadata({
      group_name: 'LE SSERAFIM',
      artist_name: 'YUNJIN',
      song_title: 'DALLA DALLA',
      event: '@INKIGAYO',
    });

    expect(resolved).toEqual({
      group_id: 1,
      artist_id: 10,
      song_id: 20,
      event_id: 30,
      group_name: 'LE SSERAFIM',
      artist_name: 'YUNJIN',
      song_title: 'DALLA DALLA',
      event: 'INKIGAYO',
    });
  });

  it('resolves aliases and returns canonical dictionary names', async () => {
    const resolved = await resolveParsedMetadata({
      group_name: '르세라핌',
      artist_name: '허윤진',
      song_title: '달라달라',
      event: '@SBS INKIGAYO',
    });

    expect(resolved).toEqual({
      group_id: 1,
      artist_id: 10,
      song_id: 20,
      event_id: 30,
      group_name: 'LE SSERAFIM',
      artist_name: 'YUNJIN',
      song_title: 'DALLA DALLA',
      event: 'INKIGAYO',
    });
  });

  it('keeps original values and null ids when entity is not found', async () => {
    const resolved = await resolveParsedMetadata({
      group_name: 'UNKNOWN GROUP',
      artist_name: 'UNKNOWN ARTIST',
      song_title: 'UNKNOWN SONG',
      event: '@UNKNOWN EVENT',
    });

    expect(resolved).toEqual({
      group_id: null,
      artist_id: null,
      song_id: null,
      event_id: null,
      group_name: 'UNKNOWN GROUP',
      artist_name: 'UNKNOWN ARTIST',
      song_title: 'UNKNOWN SONG',
      event: '@UNKNOWN EVENT',
    });
  });
});
