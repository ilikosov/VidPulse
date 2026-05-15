import { beforeEach, describe, expect, it, vi } from 'vitest';

type Video = { id: number; duration_seconds: number | null };
type VideoTag = { video_id: number; tag_id: number };

const state = {
  tags: new Map<string, number>(),
  videos: [] as Video[],
  videoTags: [] as VideoTag[],
  nextTagId: 1,
};

function makeDb() {
  const db: any = (table: string) => {
    if (table === 'tags') {
      return {
        whereRaw: (_: string, [name]: [string]) => ({
          first: async () => {
            const id = state.tags.get(name.trim().toLowerCase());
            return id ? { id } : undefined;
          },
        }),
        insert: ({ name }: { name: string }) => ({
          returning: async () => {
            const key = name.trim().toLowerCase();
            const existing = state.tags.get(key);
            if (existing) return [{ id: existing }];
            const id = state.nextTagId++;
            state.tags.set(key, id);
            return [{ id }];
          },
        }),
      };
    }

    if (table === 'videos') {
      const query: any = {
        _notNull: false,
        _op: '<',
        _value: Infinity,
        whereNotNull: () => ((query._notNull = true), query),
        where: (_col: string, op: string, value: number) => (
          (query._op = op),
          (query._value = value),
          query
        ),
        count: () => ({
          first: async () => ({
            count: String(
              state.videos.filter((v) => {
                if (query._notNull && v.duration_seconds === null) return false;
                if (query._op === '<') return (v.duration_seconds as number) < query._value;
                if (query._op === '>') return (v.duration_seconds as number) > query._value;
                return true;
              }).length,
            ),
          }),
        }),
        select: () => query,
        then: (resolve: (value: Array<{ id: number }>) => void) => {
          resolve(
            state.videos
              .filter(
                (v) =>
                  v.duration_seconds !== null &&
                  (query._op === '<' ? (v.duration_seconds as number) < query._value : true),
              )
              .map((v) => ({ id: v.id })),
          );
        },
      };
      return query;
    }

    if (table === 'videos as v') {
      const query: any = {
        _tagId: 0,
        _min: 0,
        join: () => query,
        where: (_col: string, value: number) => ((query._tagId = value), query),
        whereNotNull: () => query,
        andWhere: () => query,
        count: () => ({
          first: async () => ({
            count: String(
              state.videoTags.filter((vt) => {
                if (vt.tag_id !== query._tagId) return false;
                const video = state.videos.find((v) => v.id === vt.video_id);
                return video && video.duration_seconds !== null && video.duration_seconds > 1200;
              }).length,
            ),
          }),
        }),
      };
      query.where = (col: string, opOrVal: any, val?: any) => {
        if (col === 'vt.tag_id') query._tagId = Number(opOrVal);
        return query;
      };
      return query;
    }

    if (table === 'video_tags') {
      const query: any = {
        insert: (value: VideoTag | VideoTag[]) => ({
          onConflict: () => ({
            ignore: async () => {
              const list = Array.isArray(value) ? value : [value];
              for (const row of list) {
                if (
                  !state.videoTags.some(
                    (x) => x.video_id === row.video_id && x.tag_id === row.tag_id,
                  )
                )
                  state.videoTags.push(row);
              }
            },
          }),
        }),
        select: () => query,
        where: (_col: string, tagId: number) => ((query._tagId = tagId), query),
        whereIn: (_col: string, ids: number[]) =>
          Promise.resolve(
            state.videoTags
              .filter((x) => x.tag_id === query._tagId && ids.includes(x.video_id))
              .map((x) => ({ video_id: x.video_id })),
          ),
      };
      return query;
    }

    throw new Error(`Unsupported table ${table}`);
  };

  db.transaction = async (fn: (trx: any) => Promise<any>) => fn(db);
  db.raw = async (_sql: string, [tagId, min]: [number, number]) => {
    for (const v of state.videos) {
      if (v.duration_seconds !== null && v.duration_seconds > min) {
        if (!state.videoTags.some((x) => x.video_id === v.id && x.tag_id === tagId))
          state.videoTags.push({ video_id: v.id, tag_id: tagId });
      }
    }
  };
  return db;
}

const mockedKnex = vi.hoisted(() => makeDb());
vi.mock('../db', () => ({ default: mockedKnex }));

import { assignAutoTags, tagLongVideosByDuration } from './tag.service';

describe('tag service', () => {
  beforeEach(() => {
    state.tags.clear();
    state.videoTags = [];
    state.nextTagId = 1;
    state.videos = [
      { id: 1, duration_seconds: 89 },
      { id: 2, duration_seconds: 90 },
      { id: 3, duration_seconds: 1200 },
      { id: 4, duration_seconds: 1201 },
      { id: 5, duration_seconds: null },
    ];
  });

  it('assignAutoTags(89) adds shorts, not long', async () => {
    await assignAutoTags(100, 89, 'public');
    const shortsId = state.tags.get('shorts') as number;
    const longId = state.tags.get('длинное видео');
    expect(state.videoTags.some((x) => x.video_id === 100 && x.tag_id === shortsId)).toBe(true);
    expect(
      longId ? state.videoTags.some((x) => x.video_id === 100 && x.tag_id === longId) : false,
    ).toBe(false);
  });

  it('assignAutoTags(90) adds neither shorts nor long', async () => {
    await assignAutoTags(101, 90, 'public');
    expect(state.videoTags.some((x) => x.video_id === 101)).toBe(false);
  });

  it('assignAutoTags(1200) does not add long', async () => {
    await assignAutoTags(102, 1200, 'public');
    expect(state.videoTags.some((x) => x.video_id === 102)).toBe(false);
  });

  it('assignAutoTags(1201) adds long', async () => {
    await assignAutoTags(103, 1201, 'public');
    const longId = state.tags.get('длинное видео') as number;
    expect(state.videoTags.some((x) => x.video_id === 103 && x.tag_id === longId)).toBe(true);
  });

  it('tagLongVideosByDuration tags eligible videos and repeat does not duplicate', async () => {
    const first = await tagLongVideosByDuration();
    expect(first).toEqual({ checked: 4, eligible: 1, tagged: 1, alreadyTagged: 0 });

    const second = await tagLongVideosByDuration();
    expect(second).toEqual({ checked: 4, eligible: 1, tagged: 0, alreadyTagged: 1 });
  });
});
