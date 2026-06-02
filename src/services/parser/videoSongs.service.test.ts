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
  await testKnex.schema.createTable('video_songs', (t) => {
    t.integer('video_id').notNullable();
    t.integer('song_id').notNullable();
    t.primary(['video_id', 'song_id']);
  });

  await testKnex('videos').insert([{ id: 42 }, { id: 7 }]);
  await testKnex('dictionary_songs').insert({ id: 1, title: 'ASAP' });
});

beforeEach(async () => {
  await testKnex('video_songs').del();
  await testKnex('dictionary_songs').whereNot({ id: 1 }).del();
});

afterAll(async () => {
  await testKnex.destroy();
});

describe('syncVideoSongs', () => {
  it('creates missing songs and links video to each unique song title', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP', 'Bubble', ' BEAUTIFUL MONSTER ']);

    const dictionarySongs = await testKnex('dictionary_songs').select('*').orderBy('id', 'asc');
    const videoSongs = await testKnex('video_songs').select('*').orderBy('song_id', 'asc');

    expect(dictionarySongs.map((s) => s.title)).toEqual(['ASAP', 'Bubble', 'BEAUTIFUL MONSTER']);
    const asap = dictionarySongs.find((s) => s.title === 'ASAP')!;
    const bubble = dictionarySongs.find((s) => s.title === 'Bubble')!;
    const monster = dictionarySongs.find((s) => s.title === 'BEAUTIFUL MONSTER')!;
    expect(videoSongs).toEqual([
      { video_id: 42, song_id: asap.id },
      { video_id: 42, song_id: bubble.id },
      { video_id: 42, song_id: monster.id },
    ]);
  });

  it('supports legacy single-field song_title split by plus', async () => {
    await syncVideoSongs(7, 'Bubble + ASAP + Bubble');

    const dictionarySongs = await testKnex('dictionary_songs').select('*').orderBy('id', 'asc');
    const videoSongs = await testKnex('video_songs').select('*').orderBy('song_id', 'asc');

    expect(dictionarySongs.map((s) => s.title)).toEqual(['ASAP', 'Bubble']);
    const asap = dictionarySongs.find((s) => s.title === 'ASAP')!;
    const bubble = dictionarySongs.find((s) => s.title === 'Bubble')!;
    expect(videoSongs).toEqual([
      { video_id: 7, song_id: asap.id },
      { video_id: 7, song_id: bubble.id },
    ]);
  });

  it('fully replaces the set, unlinking songs no longer present', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP']);
    await syncVideoSongs(42, undefined, ['Bubble', 'BEAUTIFUL MONSTER']);

    const titles = await testKnex('video_songs as vs')
      .join('dictionary_songs as ds', 'vs.song_id', 'ds.id')
      .where('vs.video_id', 42)
      .pluck('ds.title');

    expect(titles.sort()).toEqual(['BEAUTIFUL MONSTER', 'Bubble']);
  });

  it('removes all links when the new set is empty', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP']);
    await syncVideoSongs(42, undefined, []);

    const remaining = await testKnex('video_songs').where('video_id', 42);
    expect(remaining).toEqual([]);
  });

  it('scopes writes to a passed transaction', async () => {
    await testKnex.transaction(async (trx) => {
      await syncVideoSongs(7, undefined, ['Bubble'], trx);
    });

    const remaining = await testKnex('video_songs').where('video_id', 7);
    expect(remaining).toHaveLength(1);
  });
});

describe('getVideoSongsMap', () => {
  it('returns alphabetically ordered songs keyed by video id', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP']);
    await syncVideoSongs(7, undefined, ['Bubble']);

    const map = await getVideoSongsMap([42, 7]);

    expect(map.get(42)!.map((s) => s.title)).toEqual(['ASAP', 'Bubble']);
    expect(map.get(7)!.map((s) => s.title)).toEqual(['Bubble']);
  });

  it('omits videos without songs and handles empty input', async () => {
    expect((await getVideoSongsMap([])).size).toBe(0);
    expect((await getVideoSongsMap([42])).has(42)).toBe(false);
  });
});
