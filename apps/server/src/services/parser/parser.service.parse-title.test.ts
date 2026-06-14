import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';

const { testKnex } = vi.hoisted(() => {
  const Knex = require('knex');
  const testKnex = Knex({
    client: 'better-sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
  });
  return { testKnex };
});

vi.mock('@vidpulse/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vidpulse/db')>()),
  knex: testKnex,
}));

import { ParserService } from './parser.service';
import { DictionaryModule } from './dictionary.module';

const dictionaryModule = new DictionaryModule();
const parserService = new ParserService([
  {
    async parse() {
      return {
        metadata: {
          group_name: 'STAYC',
          artist_name: 'ISA',
          song_title: 'Bubble + BEAUTIFUL MONSTER + ASAP',
        },
        confidence: 1,
      };
    },
  },
]);

const parserWithDictionary = new ParserService(
  [
    {
      async parse() {
        return {
          metadata: { group_name: 'STAYC', artist_name: 'ISA', song_title: 'ASAP' },
          confidence: 1,
        };
      },
    },
    dictionaryModule,
  ],
  dictionaryModule,
);

// A module that extracts nothing — the description fallback is the only source.
const parserForDescription = new ParserService(
  [
    {
      async parse() {
        return { metadata: {}, confidence: 0 };
      },
    },
  ],
  dictionaryModule,
);

beforeAll(async () => {
  await testKnex.schema.createTable('dictionary_groups', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('type');
    t.boolean('active').defaultTo(true);
  });
  await testKnex.schema.createTable('dictionary_artists', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.integer('group_id').unsigned();
  });
  await testKnex.schema.createTable('dictionary_songs', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.string('title').notNullable();
    t.string('artist');
  });
  await testKnex.schema.createTable('dictionary_song_groups', (t: Knex.CreateTableBuilder) => {
    t.integer('song_id').notNullable();
    t.integer('group_id').notNullable();
    t.primary(['song_id', 'group_id']);
  });
  await testKnex.schema.createTable('dictionary_song_artists', (t: Knex.CreateTableBuilder) => {
    t.integer('song_id').notNullable();
    t.integer('artist_id').notNullable();
    t.primary(['song_id', 'artist_id']);
  });
  await testKnex.schema.createTable('dictionary_events', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.string('name').notNullable();
  });
  await testKnex.schema.createTable('dictionary_aliases', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.string('entity_type').notNullable();
    t.integer('entity_id').notNullable();
    t.string('alias').notNullable();
  });
  await testKnex.schema.createTable('videos', (t: Knex.CreateTableBuilder) => {
    t.increments('id').primary();
    t.integer('group_id');
    t.string('group_name');
    t.integer('song_id');
    t.string('song_title');
  });
  await testKnex.schema.createTable('video_songs', (t: Knex.CreateTableBuilder) => {
    t.integer('video_id').notNullable();
    t.integer('song_id').notNullable();
    t.primary(['video_id', 'song_id']);
  });

  const [groupId] = await testKnex('dictionary_groups').insert({
    name: 'STAYC',
    type: 'female',
    active: 1,
  });
  const [artistId] = await testKnex('dictionary_artists').insert({
    name: 'ISA',
    group_id: groupId,
  });
  const [bubbleId] = await testKnex('dictionary_songs').insert({
    title: 'Bubble',
    artist: 'STAYC',
  });
  const [monsterId] = await testKnex('dictionary_songs').insert({
    title: 'BEAUTIFUL MONSTER',
    artist: 'STAYC',
  });
  const [asapId] = await testKnex('dictionary_songs').insert({ title: 'ASAP', artist: 'STAYC' });
  await testKnex('dictionary_song_groups').insert([
    { song_id: bubbleId, group_id: groupId },
    { song_id: monsterId, group_id: groupId },
    { song_id: asapId, group_id: groupId },
  ]);
  await testKnex('dictionary_song_artists').insert([{ song_id: asapId, artist_id: artistId }]);
  await testKnex('dictionary_aliases').insert([
    { entity_type: 'group', entity_id: groupId, alias: '스테이씨' },
    { entity_type: 'artist', entity_id: artistId, alias: '아이사' },
  ]);
});

afterAll(async () => {
  await testKnex.destroy();
});

describe('ParserService.parseTitle with in-memory sqlite', () => {
  it('splits multiple songs by plus and keeps last as song_title', async () => {
    const result = await parserService.parseTitle(
      "260514 스테이씨 아이사 선문대 'Bubble + BEAUTIFUL MONSTER + ASAP' 직캠 (STAYC ISA FanCam)",
    );

    expect(result.metadata.song_titles).toEqual(['Bubble', 'BEAUTIFUL MONSTER', 'ASAP']);
    expect(result.metadata.song_title).toBe('ASAP');
  });

  it('keeps backward compatibility for single song', async () => {
    const result = await parserWithDictionary.parseTitle("260514 스테이씨 아이사 'ASAP' 직캠");

    expect(result.metadata.song_titles).toEqual(['ASAP']);
    expect(result.metadata.song_title).toBe('ASAP');
    expect(result.metadata.is_own_group_song).toBe(true);
    expect(result.metadata.is_own_artist_song).toBe(true);
  });

  it('emits a parser trace describing the pipeline stages', async () => {
    const result = await parserWithDictionary.parseTitle("260514 스테이씨 아이사 'ASAP' 직캠");

    expect(Array.isArray(result.trace)).toBe(true);
    const stages = result.trace.map((step) => step.stage);
    // The module that produced metadata and the final review decision are always traced.
    expect(stages).toContain('Review decision');
    expect(stages.some((s) => s === 'Song ownership')).toBe(true);
    const review = result.trace.find((step) => step.stage === 'Review decision');
    expect(review?.confidence).toBe(result.metadata.confidence);
  });

  it('falls back to the description for identity fields the title left empty', async () => {
    const result = await parserForDescription.parseTitle(
      '260514 some untitled stage',
      undefined,
      undefined,
      '아이사 직캠입니다. 구독 부탁드려요!',
    );

    expect(result.metadata.artist_name).toBe('ISA');
    expect(result.metadata.group_name).toBe('STAYC');
  });

  it('does not let the description override fields parsed from the title', async () => {
    const result = await parserWithDictionary.parseTitle(
      "260514 스테이씨 아이사 'ASAP' 직캠",
      undefined,
      undefined,
      'Bubble teaser coming soon',
    );

    // Title already names the song — the description mention of another song is ignored.
    expect(result.metadata.song_title).toBe('ASAP');
    expect(result.metadata.group_name).toBe('STAYC');
    expect(result.metadata.artist_name).toBe('ISA');
  });
});
