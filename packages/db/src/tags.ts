import knex from './connection';
import type { Knex } from 'knex';

export const SHORTS_MAX_DURATION_SECONDS = 90;
export const SHORTS_TAG = 'shorts';
export const LEGACY_SHORT_TAG = 'short';
export const LONG_VIDEO_MIN_DURATION_SECONDS = 20 * 60;
export const LONG_VIDEO_TAG = 'длинное видео';

async function findOrCreateTagId(
  tagName: string,
  db: Knex | Knex.Transaction = knex,
): Promise<number> {
  const normalizedName = tagName.trim();
  const existingTag = await db('tags').whereRaw('LOWER(name) = LOWER(?)', [normalizedName]).first();

  if (existingTag) {
    return existingTag.id;
  }

  const inserted = await db('tags').insert({ name: normalizedName }).returning('id');
  const value = Array.isArray(inserted) ? inserted[0] : inserted;
  return typeof value === 'object' ? value.id : value;
}

export async function addTagToVideo(
  videoId: number,
  tagName: string,
  db: Knex | Knex.Transaction = knex,
): Promise<void> {
  const tagId = await findOrCreateTagId(tagName, db);
  await db('video_tags')
    .insert({ video_id: videoId, tag_id: tagId })
    .onConflict(['video_id', 'tag_id'])
    .ignore();
}

/**
 * Callers running inside a transaction MUST pass it as `db`: SQLite has a single write
 * connection, so writing through the global pool while a transaction holds the lock
 * deadlocks until knex's acquireConnectionTimeout.
 */
export async function assignAutoTags(
  videoId: number,
  durationSeconds?: number,
  privacyStatus?: string,
  db: Knex | Knex.Transaction = knex,
): Promise<void> {
  if (typeof durationSeconds === 'number' && durationSeconds > 0) {
    if (durationSeconds < SHORTS_MAX_DURATION_SECONDS) {
      await addTagToVideo(videoId, SHORTS_TAG, db);
    }
    if (durationSeconds > LONG_VIDEO_MIN_DURATION_SECONDS) {
      await addTagToVideo(videoId, LONG_VIDEO_TAG, db);
    }
  }

  if (privacyStatus === 'private') {
    await addTagToVideo(videoId, 'private', db);
  }
}

export async function tagShortsByDuration(db: Knex | Knex.Transaction = knex): Promise<{
  checked: number;
  eligible: number;
  tagged: number;
  alreadyTagged: number;
}> {
  return db.transaction(async (trx) => {
    const shortsTagId = await findOrCreateTagId(SHORTS_TAG, trx);

    const checkedRow = await trx('videos')
      .whereNotNull('duration_seconds')
      .count('* as count')
      .first();
    const checked = Number(checkedRow?.count ?? 0);

    const eligibleRows = (await trx('videos')
      .select('id')
      .whereNotNull('duration_seconds')
      .where('duration_seconds', '<', SHORTS_MAX_DURATION_SECONDS)) as Array<{ id: number }>;
    const eligibleVideoIds = eligibleRows.map((row) => row.id);
    const eligible = eligibleVideoIds.length;

    if (eligible === 0) {
      return { checked, eligible, tagged: 0, alreadyTagged: 0 };
    }

    const existingRows = (await trx('video_tags')
      .select('video_id')
      .where('tag_id', shortsTagId)
      .whereIn('video_id', eligibleVideoIds)) as Array<{ video_id: number }>;
    const alreadyTagged = existingRows.length;

    const existingSet = new Set(existingRows.map((row) => row.video_id));
    const toInsert = eligibleVideoIds
      .filter((videoId) => !existingSet.has(videoId))
      .map((videoId) => ({ video_id: videoId, tag_id: shortsTagId }));

    if (toInsert.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        await trx('video_tags')
          .insert(toInsert.slice(i, i + chunkSize))
          .onConflict(['video_id', 'tag_id'])
          .ignore();
      }
    }

    const existingAfterRows = (await trx('video_tags')
      .select('video_id')
      .where('tag_id', shortsTagId)
      .whereIn('video_id', eligibleVideoIds)) as Array<{ video_id: number }>;

    const tagged = existingAfterRows.length - alreadyTagged;
    return { checked, eligible, tagged, alreadyTagged };
  });
}

export async function tagLongVideosByDuration(db: Knex | Knex.Transaction = knex): Promise<{
  checked: number;
  eligible: number;
  tagged: number;
  alreadyTagged: number;
}> {
  return db.transaction(async (trx) => {
    const longTagId = await findOrCreateTagId(LONG_VIDEO_TAG, trx);

    const checkedRow = await trx('videos')
      .whereNotNull('duration_seconds')
      .count('* as count')
      .first();
    const checked = Number(checkedRow?.count ?? 0);

    const eligibleRow = await trx('videos')
      .whereNotNull('duration_seconds')
      .where('duration_seconds', '>', LONG_VIDEO_MIN_DURATION_SECONDS)
      .count('* as count')
      .first();
    const eligible = Number(eligibleRow?.count ?? 0);

    const beforeRow = await trx('videos as v')
      .join('video_tags as vt', 'vt.video_id', 'v.id')
      .where('vt.tag_id', longTagId)
      .whereNotNull('v.duration_seconds')
      .where('v.duration_seconds', '>', LONG_VIDEO_MIN_DURATION_SECONDS)
      .count('* as count')
      .first();
    const before = Number(beforeRow?.count ?? 0);

    await trx.raw(
      `INSERT OR IGNORE INTO video_tags (video_id, tag_id)
       SELECT id, ?
       FROM videos
       WHERE duration_seconds IS NOT NULL
         AND duration_seconds > ?`,
      [longTagId, LONG_VIDEO_MIN_DURATION_SECONDS],
    );

    const afterRow = await trx('videos as v')
      .join('video_tags as vt', 'vt.video_id', 'v.id')
      .where('vt.tag_id', longTagId)
      .whereNotNull('v.duration_seconds')
      .where('v.duration_seconds', '>', LONG_VIDEO_MIN_DURATION_SECONDS)
      .count('* as count')
      .first();
    const after = Number(afterRow?.count ?? 0);

    return {
      checked,
      eligible,
      tagged: after - before,
      alreadyTagged: before,
    };
  });
}

export async function mergeShortTags(db: Knex | Knex.Transaction = knex): Promise<{
  shortsTagId: number;
  legacyShortTagId: number | null;
  moved: number;
  removedLegacyTag: boolean;
}> {
  return db.transaction(async (trx) => {
    const shortsTagId = await findOrCreateTagId(SHORTS_TAG, trx);
    const legacy = await trx('tags').whereRaw('LOWER(name) = LOWER(?)', [LEGACY_SHORT_TAG]).first();
    if (!legacy) {
      return { shortsTagId, legacyShortTagId: null, moved: 0, removedLegacyTag: false };
    }

    const legacyShortTagId = legacy.id as number;
    const legacyRows = (await trx('video_tags')
      .select('video_id')
      .where('tag_id', legacyShortTagId)) as Array<{ video_id: number }>;
    const legacyVideoIds = legacyRows.map((row) => row.video_id);

    if (legacyVideoIds.length > 0) {
      await trx('video_tags')
        .insert(legacyVideoIds.map((videoId) => ({ video_id: videoId, tag_id: shortsTagId })))
        .onConflict(['video_id', 'tag_id'])
        .ignore();
    }

    await trx('video_tags').where('tag_id', legacyShortTagId).del();
    await trx('tags').where('id', legacyShortTagId).del();

    return { shortsTagId, legacyShortTagId, moved: legacyVideoIds.length, removedLegacyTag: true };
  });
}
