import { describe, expect, it, vi, beforeEach } from 'vitest';

const { dictionarySongs, videoSongs, mockedKnex } = vi.hoisted(() => {
  const dictionarySongs = [{ id: 1, title: 'ASAP' }];
  const videoSongs: Array<{ video_id: number; song_id: number }> = [];

  const mockedKnex = ((tableName: string) => {
    if (tableName === 'dictionary_songs') {
      const state: { lookupTitle?: string } = {};
      return {
        select() {
          return this;
        },
        whereRaw(_sql: string, values: unknown[]) {
          state.lookupTitle = String(values[0]).toLowerCase();
          return this;
        },
        async first() {
          return dictionarySongs.find((song) => song.title.toLowerCase() === state.lookupTitle);
        },
        insert(data: { title: string }) {
          const nextId = dictionarySongs.length + 1;
          dictionarySongs.push({ id: nextId, title: data.title });
          return {
            async returning() {
              return [{ id: nextId }];
            },
          };
        },
      };
    }

    if (tableName === 'video_songs') {
      return {
        insert(data: { video_id: number; song_id: number }) {
          return {
            onConflict() {
              return {
                async ignore() {
                  const exists = videoSongs.some(
                    (item) => item.video_id === data.video_id && item.song_id === data.song_id,
                  );
                  if (!exists) videoSongs.push(data);
                },
              };
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table: ${tableName}`);
  }) as any;

  return { dictionarySongs, videoSongs, mockedKnex };
});

vi.mock('../../db', () => ({ default: mockedKnex }));

import { syncVideoSongs } from './videoSongs.service';

describe('syncVideoSongs', () => {
  beforeEach(() => {
    dictionarySongs.splice(1);
    videoSongs.length = 0;
    vi.clearAllMocks();
  });

  it('creates missing songs and links video to each unique song title', async () => {
    await syncVideoSongs(42, undefined, ['Bubble', 'ASAP', 'Bubble', ' BEAUTIFUL MONSTER ']);

    expect(dictionarySongs.map((s) => s.title)).toEqual(['ASAP', 'Bubble', 'BEAUTIFUL MONSTER']);
    expect(videoSongs).toEqual([
      { video_id: 42, song_id: 2 },
      { video_id: 42, song_id: 1 },
      { video_id: 42, song_id: 3 },
    ]);
  });

  it('supports legacy single-field song_title split by plus', async () => {
    await syncVideoSongs(7, 'Bubble + ASAP + Bubble');

    expect(dictionarySongs.map((s) => s.title)).toEqual(['ASAP', 'Bubble']);
    expect(videoSongs).toEqual([
      { video_id: 7, song_id: 2 },
      { video_id: 7, song_id: 1 },
    ]);
  });
});
