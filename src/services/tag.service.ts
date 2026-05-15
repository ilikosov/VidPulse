import knex from '../db';

export const SHORTS_MAX_DURATION_SECONDS = 90;
export const SHORTS_TAG = 'shorts';
export const LEGACY_SHORT_TAG = 'short';

async function findOrCreateTagId(tagName: string, db: typeof knex = knex): Promise<number> {
  const normalizedName = tagName.trim();
  const existingTag = await db('tags').whereRaw('LOWER(name) = LOWER(?)', [normalizedName]).first();

  if (existingTag) {
    return existingTag.id;
  }

  const inserted = await db('tags').insert({ name: normalizedName }).returning('id');
  const value = Array.isArray(inserted) ? inserted[0] : inserted;
  return typeof value === 'object' ? value.id : value;
}

export async function addTagToVideo(videoId: number, tagName: string): Promise<void> {
  const tagId = await findOrCreateTagId(tagName);
  await knex('video_tags')
    .insert({ video_id: videoId, tag_id: tagId })
    .onConflict(['video_id', 'tag_id'])
    .ignore();
}

export async function assignAutoTags(
  videoId: number,
  durationSeconds?: number,
  privacyStatus?: string,
): Promise<void> {
  if (typeof durationSeconds === 'number' && durationSeconds > 0) {
    if (durationSeconds < SHORTS_MAX_DURATION_SECONDS) {
      await addTagToVideo(videoId, SHORTS_TAG);
    } else {
      await addTagToVideo(videoId, 'длинное видео');
    }
  }

  if (privacyStatus === 'private') {
    await addTagToVideo(videoId, 'private');
  }
}

export async function tagShortsByDuration(): Promise<{
  checked: number;
  eligible: number;
  tagged: number;
  alreadyTagged: number;
}> {
  return knex.transaction(async (trx) => {
    const shortsTagId = await (async () => {
      const existing = await trx('tags').whereRaw('LOWER(name) = LOWER(?)', [SHORTS_TAG]).first();
      if (existing) return existing.id as number;
      const inserted = await trx('tags').insert({ name: SHORTS_TAG }).returning('id');
      const value = Array.isArray(inserted) ? inserted[0] : inserted;
      return (typeof value === 'object' ? value.id : value) as number;
    })();

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

    const existingSet = new Set(existingRows.map((row) => row.video_id));
    const toInsert = eligibleVideoIds
      .filter((videoId) => !existingSet.has(videoId))
      .map((videoId) => ({ video_id: videoId, tag_id: shortsTagId }));

    if (toInsert.length > 0) {
      await trx('video_tags').insert(toInsert).onConflict(['video_id', 'tag_id']).ignore();
    }

    const tagged = toInsert.length;
    const alreadyTagged = eligible - tagged;
    return { checked, eligible, tagged, alreadyTagged };
  });
}

export async function mergeShortTags(): Promise<{
  shortsTagId: number;
  legacyShortTagId: number | null;
  moved: number;
  removedLegacyTag: boolean;
}> {
  return knex.transaction(async (trx) => {
    const shortsTagId = await findOrCreateTagId(SHORTS_TAG, trx as unknown as typeof knex);
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
