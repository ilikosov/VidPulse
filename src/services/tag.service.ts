import knex from '../db';

async function findOrCreateTagId(tagName: string): Promise<number> {
  const normalizedName = tagName.trim();
  const existingTag = await knex('tags')
    .whereRaw('LOWER(name) = LOWER(?)', [normalizedName])
    .first();

  if (existingTag) {
    return existingTag.id;
  }

  const inserted = await knex('tags').insert({ name: normalizedName }).returning('id');
  const value = Array.isArray(inserted) ? inserted[0] : inserted;
  return typeof value === 'object' ? value.id : value;
}

export async function addTagToVideo(videoId: number, tagName: string): Promise<void> {
  const tagId = await findOrCreateTagId(tagName);
  await knex('video_tags').insert({ video_id: videoId, tag_id: tagId }).onConflict(['video_id', 'tag_id']).ignore();
}

export async function assignAutoTags(
  videoId: number,
  durationSeconds?: number,
  privacyStatus?: string,
): Promise<void> {
  if (typeof durationSeconds === 'number' && durationSeconds <= 60) {
    await addTagToVideo(videoId, 'short');
  }

  if (privacyStatus === 'private') {
    await addTagToVideo(videoId, 'private');
  }
}
