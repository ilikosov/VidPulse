import { Request, Response, Router } from 'express';
import knex from '../db';

const router = Router();
const COLORS = [
  'magenta',
  'red',
  'volcano',
  'orange',
  'gold',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
];
const MAX_VIDEO_LIST_ITEMS = Number(process.env.MAX_VIDEO_LIST_ITEMS || '100');

const validateVideoIds = (body: unknown): number[] | null => {
  const videoIds = (body as { videoIds?: unknown })?.videoIds;
  if (!Array.isArray(videoIds) || !videoIds.every((id) => Number.isInteger(id) && id > 0))
    return null;
  return videoIds;
};

async function ensureVideosCanBeAssigned(videoIds: number[], listId?: number) {
  if (videoIds.length === 0) return { ok: true as const };
  const rows = await knex('videos').select('id', 'video_list_id').whereIn('id', videoIds);
  if (rows.length !== videoIds.length)
    return { ok: false as const, error: 'Some videos not found' };
  const alreadyAssigned = rows.find((v) => v.video_list_id !== null && v.video_list_id !== listId);
  if (alreadyAssigned)
    return { ok: false as const, error: 'One or more videos already belongs to another list' };
  return { ok: true as const };
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const videoIds = validateVideoIds(req.body) ?? [];
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (videoIds.length > MAX_VIDEO_LIST_ITEMS)
      return res.status(409).json({ error: 'Video list limit exceeded' });

    const assignCheck = await ensureVideosCanBeAssigned(videoIds);
    if (!assignCheck.ok) return res.status(409).json({ error: assignCheck.error });

    const usedColors = (await knex('video_lists').select('color')).map((row) => row.color);
    const color =
      COLORS.find((candidate) => !usedColors.includes(candidate)) || `custom-${Date.now()}`;

    const result = await knex('video_lists')
      .insert({ name, color })
      .returning(['id', 'name', 'color', 'created_at', 'updated_at']);
    const created = Array.isArray(result) ? result[0] : result;

    if (videoIds.length > 0) {
      await knex('videos')
        .whereIn('id', videoIds)
        .update({ video_list_id: created.id, updated_at: new Date().toISOString() });
    }

    return res.status(201).json({ ...created, countVideos: videoIds.length });
  } catch (error) {
    console.error('Error creating video list:', error);
    return res.status(500).json({ error: 'Failed to create video list' });
  }
});

router.get('/', async (_req, res) => {
  const lists = await knex('video_lists as l')
    .leftJoin('videos as v', 'v.video_list_id', 'l.id')
    .groupBy('l.id')
    .select('l.id', 'l.name', 'l.color')
    .count<{ countVideos: number }>('v.id as countVideos');
  res.json(lists);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const list = await knex('video_lists').where({ id }).first();
  if (!list) return res.status(404).json({ error: 'List not found' });
  const videos = await knex('videos as v')
    .leftJoin('video_tags as vt', 'vt.video_id', 'v.id')
    .leftJoin('tags as t', 't.id', 'vt.tag_id')
    .where('v.video_list_id', id)
    .orderBy('v.updated_at', 'asc')
    .select(
      'v.id',
      'v.original_title as title',
      'v.artist_name as artist',
      'v.group_name as `group`',
      'v.duration_seconds as duration',
      't.name as tag',
    );
  const byId = new Map<number, any>();
  for (const row of videos) {
    if (!byId.has(row.id))
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        artist: row.artist,
        group: row.group,
        duration: row.duration,
        tags: [],
      });
    if (row.tag) byId.get(row.id).tags.push(row.tag);
  }
  res.json({ ...list, videos: Array.from(byId.values()) });
});

router.post('/:id/videos', async (req, res) => {
  const id = Number(req.params.id);
  const videoIds = validateVideoIds(req.body);
  if (!videoIds || videoIds.length === 0)
    return res.status(400).json({ error: 'videoIds must be non-empty' });
  const currentCountRow = await knex('videos')
    .where({ video_list_id: id })
    .count<{ count: string }>('id as count')
    .first();
  const currentCount = Number(currentCountRow?.count || 0);
  if (currentCount + videoIds.length > MAX_VIDEO_LIST_ITEMS)
    return res.status(409).json({ error: 'Video list limit exceeded' });
  const assignCheck = await ensureVideosCanBeAssigned(videoIds, id);
  if (!assignCheck.ok) return res.status(409).json({ error: assignCheck.error });
  await knex('videos')
    .whereIn('id', videoIds)
    .update({ video_list_id: id, updated_at: new Date().toISOString() });
  return res.json({ processed: videoIds.length, succeeded: videoIds.length });
});

router.delete('/:id/videos', async (req, res) => {
  const id = Number(req.params.id);
  const videoIds = validateVideoIds(req.body);
  if (!videoIds || videoIds.length === 0)
    return res.status(400).json({ error: 'videoIds must be non-empty' });
  await knex('videos')
    .where({ video_list_id: id })
    .whereIn('id', videoIds)
    .update({ video_list_id: null, updated_at: new Date().toISOString() });
  return res.json({ processed: videoIds.length });
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'name is required' });
  await knex('video_lists').where({ id }).update({ name, updated_at: new Date().toISOString() });
  return res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await knex('videos')
    .where({ video_list_id: id })
    .update({ video_list_id: null, updated_at: new Date().toISOString() });
  await knex('video_lists').where({ id }).del();
  return res.json({ ok: true });
});

router.post('/:id/batch', async (req, res) => {
  const id = Number(req.params.id);
  const operation = req.body?.operation;
  const videoIds = validateVideoIds(req.body);
  if (!videoIds || videoIds.length === 0)
    return res.status(400).json({ error: 'videoIds must be non-empty' });
  if (operation === 'removeFromList') {
    await knex('videos')
      .where({ video_list_id: id })
      .whereIn('id', videoIds)
      .update({ video_list_id: null, updated_at: new Date().toISOString() });
    return res.json({ operation, processed: videoIds.length, succeeded: videoIds.length });
  }
  if (operation === 'addTag') {
    return res.status(400).json({ error: 'Use /api/videos/batch/tags for addTag with tagName' });
  }
  if (operation === 'removeTag') {
    return res.status(400).json({ error: 'Use /api/videos/batch/tags for removeTag with tagName' });
  }
  return res.json({
    operation,
    processed: videoIds.length,
    succeeded: 0,
    skipped: videoIds.length,
  });
});

export default router;
