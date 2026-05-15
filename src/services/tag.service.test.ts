import { beforeEach, describe, expect, it, vi } from 'vitest';

type Video = { id: number; duration_seconds: number | null };
type VideoTag = { video_id: number; tag_id: number };

const state = {
  tags: new Map<string, number>(),
  videos: [] as Video[],
  videoTags: [] as VideoTag[],
  nextTagId: 1,
};

function findTagById(tagId: number): string | undefined {
  for (const [name, id] of state.tags.entries()) if (id === tagId) return name;
  return undefined;
}

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
        whereNotNull: (_col: string) => {
          query._whereNotNull = true;
          return query;
        },
        count: (_s: string) => ({
          first: async () => ({
            count: String(state.videos.filter((v) => v.duration_seconds !== null).length),
          }),
        }),
        select: (_col: string) => {
          query._select = true;
          return query;
        },
        where: (_col: string, _op: string, value: number) => {
          query._lt = value;
          return query;
        },
        then: (resolve: (value: Array<{ id: number }>) => void) => {
          const rows = state.videos
            .filter(
              (v) => v.duration_seconds !== null && (v.duration_seconds as number) < query._lt,
            )
            .map((v) => ({ id: v.id }));
          resolve(rows);
        },
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
                ) {
                  state.videoTags.push(row);
                }
              }
            },
          }),
        }),
        select: (_col: string) => {
          query._select = true;
          return query;
        },
        where: (_col: string, tagId: number) => {
          query._tagId = tagId;
          return query;
        },
        whereIn: (_col: string, ids: number[]) => {
          query._ids = ids;
          return Promise.resolve(
            state.videoTags
              .filter((x) => x.tag_id === query._tagId && ids.includes(x.video_id))
              .map((x) => ({ video_id: x.video_id })),
          );
        },
      };
      return query;
    }

    throw new Error(`Unsupported table ${table}`);
  };

  db.transaction = async (fn: (trx: any) => Promise<any>) => fn(db);
  return db;
}

const mockedKnex = vi.hoisted(() => makeDb());
vi.mock('../db', () => ({ default: mockedKnex }));

import { assignAutoTags, tagShortsByDuration } from './tag.service';

describe('tag service', () => {
  beforeEach(() => {
    state.tags.clear();
    state.videoTags = [];
    state.nextTagId = 1;
    state.videos = [
      { id: 1, duration_seconds: 89 },
      { id: 2, duration_seconds: 90 },
      { id: 3, duration_seconds: 60 },
      { id: 4, duration_seconds: null },
    ];
  });

  it('assignAutoTags adds shorts for 89', async () => {
    await assignAutoTags(100, 89, 'public');
    const shortsId = state.tags.get('shorts');
    expect(shortsId).toBeTruthy();
    expect(state.videoTags.some((x) => x.video_id === 100 && x.tag_id === shortsId)).toBe(true);
  });

  it('assignAutoTags adds длинное видео for 90', async () => {
    await assignAutoTags(101, 90, 'public');
    const longId = state.tags.get('длинное видео');
    expect(longId).toBeTruthy();
    expect(state.videoTags.some((x) => x.video_id === 101 && x.tag_id === longId)).toBe(true);
  });

  it('tagShortsByDuration tags only eligible videos and avoids duplicates on repeated call', async () => {
    const first = await tagShortsByDuration();
    expect(first).toEqual({ checked: 3, eligible: 2, tagged: 2, alreadyTagged: 0 });

    const shortsId = state.tags.get('shorts') as number;
    const taggedVideoIds = state.videoTags
      .filter((x) => x.tag_id === shortsId)
      .map((x) => x.video_id)
      .sort((a, b) => a - b);
    expect(taggedVideoIds).toEqual([1, 3]);
    expect(taggedVideoIds.includes(2)).toBe(false);

    const second = await tagShortsByDuration();
    expect(second).toEqual({ checked: 3, eligible: 2, tagged: 0, alreadyTagged: 2 });
  });

  it('tagShortsByDuration handles bulk tagging for more than 600 shorts videos', async () => {
    state.videos = Array.from({ length: 650 }, (_, index) => ({
      id: index + 1,
      duration_seconds: 45,
    }));

    const first = await tagShortsByDuration();
    expect(first).toEqual({ checked: 650, eligible: 650, tagged: 650, alreadyTagged: 0 });

    const shortsId = state.tags.get('shorts') as number;
    const taggedCount = state.videoTags.filter((x) => x.tag_id === shortsId).length;
    expect(taggedCount).toBe(650);

    const second = await tagShortsByDuration();
    expect(second).toEqual({ checked: 650, eligible: 650, tagged: 0, alreadyTagged: 650 });
  });
});
