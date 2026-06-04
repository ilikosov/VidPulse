import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const { testKnex } = vi.hoisted(() => {
  const Knex = require('knex');
  const testKnex = Knex({
    client: 'better-sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
  });
  return { testKnex };
});

vi.mock('../../db', () => ({ default: testKnex }));

import { syncVideoSongs, getVideoSongsMap } from './videoSongs.service';

beforeAll(async () => {
  await testKnex.schema.createTable('videos', (t) => {
    t.increments('id').primary();
  });
  await testKnex.schema.createTable('dictionary_songs', (t) => {
    t.increments('id').primary();
    t.string('title').notNullable();
  });
  await testKnex.schema.createTable('dictionary_aliases', (t) => {
    t.increments('id').primary();
    t.string('entity_type').notNullable();
    t.integer('entity_id').notNullable();
    t.string('alias').notNullable();
  });
  await testKnex.schema.createTable('video_songs', (t) => {
    t.integer('video_id').notNullable();
    t.integer('position').notNullable();
    t.text('raw_title').notNullable();
    t.integer('song_id').nullable();
    t.primary(['video_id', 'position']);
  });

  await testKnex('videos').insert([{ id: 42 }, { id: 7 }]);
  await testKnex('dictionary_songs').insert({ id: 1, title: 'ASAP' });
  await testKnex('dictionary_aliases').insert({ entity_type: 'song', entity_id: 1, alias: '아삽' });
});

beforeEach(async () => {
  await testKnex('video_songs').del();
  await testKnex('dictionary_songs').whereNot({ id: 1 }).del();
});

afterAll(async () => {
  await testKnex.destroy();
});

describe('syncVideoSongs', () => {
  it('stores every parsed song in order with raw_title; links matched ones, keeps unmatched as null', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP', 'Bubble', ' BEAUTIFUL MONSTER ']);

    const videoSongs = await testKnex('video_songs').select('*').orderBy('position', 'asc');
    expect(videoSongs).toEqual([
      { video_id: 42, position: 0, raw_title: 'Bubble', song_id: null },
      { video_id: 42, position: 1, raw_title: 'ASAP', song_id: 1 },
      { video_id: 42, position: 2, raw_title: 'BEAUTIFUL MONSTER', song_id: null },
    ]);

    // It must NOT auto-create dictionary entries for unmatched titles.
    const dictionaryTitles = await testKnex('dictionary_songs').pluck('title');
    expect(dictionaryTitles).toEqual(['ASAP']);
  });

  it('matches a song by alias', async () => {
    await syncVideoSongs(42, undefined, ['아삽']);
    const row = await testKnex('video_songs').where('video_id', 42).first();
    expect(row).toMatchObject({ raw_title: '아삽', song_id: 1 });
  });

  it('supports legacy single-field song_title split by plus', async () => {
    await syncVideoSongs(7, 'Bubble + ASAP + Bubble');
    const videoSongs = await testKnex('video_songs').select('*').orderBy('position', 'asc');
    expect(videoSongs).toEqual([
      { video_id: 7, position: 0, raw_title: 'Bubble', song_id: null },
      { video_id: 7, position: 1, raw_title: 'ASAP', song_id: 1 },
    ]);
  });

  it('fully replaces the set, dropping songs no longer present', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP']);
    await syncVideoSongs(42, undefined, ['ASAP', 'BEAUTIFUL MONSTER']);

    const rows = await testKnex('video_songs').where('video_id', 42).orderBy('position');
    expect(rows.map((r) => r.raw_title)).toEqual(['ASAP', 'BEAUTIFUL MONSTER']);
  });

  it('removes all rows when the new set is empty', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP']);
    await syncVideoSongs(42, undefined, []);
    expect(await testKnex('video_songs').where('video_id', 42)).toEqual([]);
  });

  it('scopes writes to a passed transaction', async () => {
    await testKnex.transaction(async (trx) => {
      await syncVideoSongs(7, undefined, ['Bubble'], trx);
    });
    expect(await testKnex('video_songs').where('video_id', 7)).toHaveLength(1);
  });
});

describe('getVideoSongsMap', () => {
  it('returns songs in position order with display title (canonical or raw)', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP']); // Bubble unmatched, ASAP -> id 1
    await syncVideoSongs(7, undefined, ['ASAP']);

    const map = await getVideoSongsMap([42, 7]);

    expect(map.get(42)).toEqual([
      { id: null, title: 'Bubble' }, // unmatched → raw title, null id
      { id: 1, title: 'ASAP' }, // matched → canonical title + id
    ]);
    expect(map.get(7)).toEqual([{ id: 1, title: 'ASAP' }]);
  });

  it('omits videos without songs and handles empty input', async () => {
    expect((await getVideoSongsMap([])).size).toBe(0);
    expect((await getVideoSongsMap([42])).has(42)).toBe(false);
  });
});
