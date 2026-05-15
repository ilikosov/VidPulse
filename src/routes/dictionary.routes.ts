import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dictionaryService } from '../services/dictionary.service';
import { buildPaginationMeta, getPaginationParams } from './pagination';
import { validateMediaLibraryPayload } from '../services/mediaLibrarySchema.service';
import {
  dangerousActionsEnabled,
  requireDangerousActionsEnabled,
} from '../middleware/dangerousActions';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
type TemplateEntity = 'groups' | 'artists' | 'songs' | 'events';
type AliasEntityType = 'group' | 'artist' | 'song' | 'event';
const aliasEntityMap: Record<string, AliasEntityType> = {
  group: 'group',
  groups: 'group',
  artist: 'artist',
  artists: 'artist',
  song: 'song',
  songs: 'song',
  event: 'event',
  events: 'event',
};

const dictionaryTemplates: Record<TemplateEntity, Record<string, string>> = {
  groups: { name: '', type: 'female' },
  artists: { name: '', group_name: '' },
  songs: { title: '', artist: '' },
  events: { name: '' },
};

router.get('/groups/list', async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const [groups, total] = await Promise.all([
    dictionaryService.getGroups(
      req.query.type as string | undefined,
      req.query.q as string | undefined,
      limit,
      offset,
    ),
    dictionaryService.countGroups(
      req.query.type as string | undefined,
      req.query.q as string | undefined,
    ),
  ]);
  return res.json({ groups, pagination: buildPaginationMeta(page, limit, total) });
});
router.post('/groups', async (req, res) => {
  const { name, type, active } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  await dictionaryService.createGroup({ name, type, active });
  res.status(201).json({ ok: true });
});
router.put('/groups/:id', async (req, res) => {
  await dictionaryService.updateGroup(Number(req.params.id), req.body);
  res.json({ ok: true });
});
router.delete('/groups/:id', async (req, res) => {
  await dictionaryService.deleteGroup(Number(req.params.id));
  res.status(204).send();
});

router.get('/artists/list', async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const groupId = req.query.group_id ? Number(req.query.group_id) : undefined;
  const [artists, total] = await Promise.all([
    dictionaryService.getArtists(groupId, req.query.q as string | undefined, limit, offset),
    dictionaryService.countArtists(groupId, req.query.q as string | undefined),
  ]);
  return res.json({ artists, pagination: buildPaginationMeta(page, limit, total) });
});
router.post('/artists', async (req, res) => {
  const { name, group_id } = req.body;
  if (!name || !group_id) return res.status(400).json({ error: 'name and group_id are required' });
  await dictionaryService.createArtist({ name, group_id: Number(group_id) });
  res.status(201).json({ ok: true });
});
router.put('/artists/:id', async (req, res) => {
  await dictionaryService.updateArtist(Number(req.params.id), {
    name: req.body.name,
    group_id: Number(req.body.group_id),
  });
  res.json({ ok: true });
});
router.delete('/artists/:id', async (req, res) => {
  await dictionaryService.deleteArtist(Number(req.params.id));
  res.status(204).send();
});

router.get('/songs/list', async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const [songs, total] = await Promise.all([
    dictionaryService.getSongs(req.query.q as string | undefined, limit, offset),
    dictionaryService.countSongs(req.query.q as string | undefined),
  ]);
  return res.json({ songs, pagination: buildPaginationMeta(page, limit, total) });
});
router.post('/songs', async (req, res) => {
  const { title, artist, artist_ids, group_ids } = req.body;
  if (!title || !artist) return res.status(400).json({ error: 'title and artist are required' });
  await dictionaryService.createSong({ title, artist, artist_ids, group_ids });
  res.status(201).json({ ok: true });
});
router.put('/songs/:id', async (req, res) => {
  const { title, artist, artist_ids, group_ids } = req.body;
  await dictionaryService.updateSong(Number(req.params.id), {
    title,
    artist,
    artist_ids,
    group_ids,
  });
  res.json({ ok: true });
});
router.delete('/songs/:id', async (req, res) => {
  await dictionaryService.deleteSong(Number(req.params.id));
  res.status(204).send();
});

router.get('/groups/:id/artists', async (req, res) => {
  const groupId = Number(req.params.id);
  const group = await dictionaryService.getGroupById(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const [artists, total] = await Promise.all([
    dictionaryService.getGroupArtists(groupId, limit, offset),
    dictionaryService.countGroupArtists(groupId),
  ]);
  return res.json({ artists, pagination: buildPaginationMeta(page, limit, total) });
});

router.get('/groups/:id/songs', async (req, res) => {
  const groupId = Number(req.params.id);
  const group = await dictionaryService.getGroupById(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const [songs, total] = await Promise.all([
    dictionaryService.getGroupSongs(groupId, limit, offset),
    dictionaryService.countGroupSongs(groupId),
  ]);
  return res.json({ songs, pagination: buildPaginationMeta(page, limit, total) });
});

router.get('/groups/:id', async (req, res) => {
  const group = await dictionaryService.getGroupById(Number(req.params.id));
  if (!group) return res.status(404).json({ error: 'Group not found' });
  return res.json(group);
});

router.get('/groups/:id/videos', async (req, res) => {
  const group = await dictionaryService.getGroupById(Number(req.params.id));
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  return res.json(await dictionaryService.getVideosByGroupId(Number(req.params.id), page, limit));
});

router.get('/artists/:id', async (req, res) => {
  const artist = await dictionaryService.getArtistById(Number(req.params.id));
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  return res.json(artist);
});

router.get('/artists/:id/songs', async (req, res) => {
  const artistId = Number(req.params.id);
  const artist = await dictionaryService.getArtistById(artistId);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const [songs, total] = await Promise.all([
    dictionaryService.getArtistSongs(artistId, limit, offset),
    dictionaryService.countArtistSongs(artistId),
  ]);
  return res.json({ songs, pagination: buildPaginationMeta(page, limit, total) });
});

router.get('/artists/:id/videos', async (req, res) => {
  const artist = await dictionaryService.getArtistById(Number(req.params.id));
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  return res.json(await dictionaryService.getVideosByArtistId(Number(req.params.id), page, limit));
});

router.get('/songs/:id', async (req, res) => {
  const song = await dictionaryService.getSongById(Number(req.params.id));
  if (!song) return res.status(404).json({ error: 'Song not found' });
  return res.json(song);
});

router.get('/songs/:id/videos', async (req, res) => {
  const song = await dictionaryService.getSongById(Number(req.params.id));
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  return res.json(await dictionaryService.getVideosBySongId(Number(req.params.id), page, limit));
});

router.get('/:entityType/:entityId/aliases', async (req, res) => {
  const entityType = aliasEntityMap[req.params.entityType];
  const entityId = Number(req.params.entityId);
  if (!entityType || !entityId) return res.status(400).json({ error: 'Invalid entity parameters' });
  return res.json(await dictionaryService.getAliases(entityType, entityId));
});

router.post('/:entityType/:entityId/aliases', async (req, res) => {
  const entityType = aliasEntityMap[req.params.entityType];
  const entityId = Number(req.params.entityId);
  const alias = String(req.body?.alias ?? '').trim();
  if (!entityType || !entityId) return res.status(400).json({ error: 'Invalid entity parameters' });
  if (!alias) return res.status(400).json({ error: 'alias is required' });
  const existing = await dictionaryService.getAliases(entityType, entityId);
  if (existing.some((item) => item.alias.toLowerCase() === alias.toLowerCase())) {
    return res.status(409).json({ error: 'Alias already exists' });
  }
  const created = await dictionaryService.addAlias(entityType, entityId, alias);
  return res.status(201).json(created);
});

router.delete('/:entityType/:entityId/aliases/:aliasId', async (req, res) => {
  const entityType = aliasEntityMap[req.params.entityType];
  const entityId = Number(req.params.entityId);
  const aliasId = Number(req.params.aliasId);
  if (!entityType || !entityId || !aliasId)
    return res.status(400).json({ error: 'Invalid entity parameters' });
  await dictionaryService.removeAlias(entityType, entityId, aliasId);
  return res.status(204).send();
});

router.get('/stats', async (_req, res) => {
  return res.json(await dictionaryService.getStats());
});

router.get('/events/list', async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req, 20, 100);
  const [events, total] = await Promise.all([
    dictionaryService.getEvents(req.query.q as string | undefined, limit, offset),
    dictionaryService.countEvents(req.query.q as string | undefined),
  ]);
  return res.json({ events, pagination: buildPaginationMeta(page, limit, total) });
});
router.post('/events', async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'name is required' });
  await dictionaryService.createEvent({ name: req.body.name });
  res.status(201).json({ ok: true });
});
router.put('/events/:id', async (req, res) => {
  await dictionaryService.updateEvent(Number(req.params.id), req.body);
  res.json({ ok: true });
});
router.delete('/events/:id', async (req, res) => {
  await dictionaryService.deleteEvent(Number(req.params.id));
  res.status(204).send();
});

router.get('/events/:id', async (req, res) => {
  const events = await dictionaryService.getEvents(undefined, 10000, 0);
  const event = events.find((item: any) => item.id === Number(req.params.id));
  if (!event) return res.status(404).json({ error: 'Event not found' });
  return res.json(event);
});

router.get('/events/:id/videos', async (req, res) => {
  const events = await dictionaryService.getEvents(undefined, 10000, 0);
  const event = events.find((item: any) => item.id === Number(req.params.id));
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  return res.json(await dictionaryService.getVideosByEventId(Number(req.params.id), page, limit));
});

router.get('/template/:entity/:format', (req, res) => {
  const format = req.params.format.toLowerCase();
  if (format === 'csv') {
    return res
      .status(410)
      .json({ error: 'CSV templates are deprecated. Use /api/dictionary/schema' });
  }
  if (format === 'json') {
    return res.redirect(302, '/api/dictionary/example');
  }
  return res.status(400).json({ error: 'unsupported format' });
});

router.get('/schema', (_req, res) => {
  return res.download('schemas/media-library.schema.json', 'media-library.schema.json');
});

router.get('/example', (_req, res) => {
  return res.download('examples/media-library.example.json', 'media-library.example.json');
});

router.get('/export', async (_req, res) => {
  const payload = await dictionaryService.exportMediaLibrary();
  res.setHeader('Content-Disposition', 'attachment; filename="vidpulse-media-library.json"');
  return res.type('application/json').send(JSON.stringify(payload, null, 2));
});

router.delete('/clear', requireDangerousActionsEnabled, async (_req, res) => {
  const summary = await dictionaryService.clearMediaLibrary();
  return res.json(summary);
});

router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const name = req.file.originalname.toLowerCase();
  if (!name.endsWith('.json')) {
    return res.status(400).json({ error: 'Only media library JSON files are supported' });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(req.file.buffer.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid media library JSON', details: ['Invalid JSON'] });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({
      error: 'Invalid media library JSON',
      details: ['Payload must be an object'],
    });
  }

  const validationResult = validateMediaLibraryPayload(payload);
  if (!validationResult.valid) {
    return res
      .status(400)
      .json({ error: 'Invalid media library JSON', details: validationResult.errors });
  }

  const mode = (payload as Record<string, unknown>).mode;
  if (mode === 'replace') {
    if (!dangerousActionsEnabled()) {
      return res.status(403).json({ error: 'Dangerous media library actions are disabled' });
    }
    await dictionaryService.clearMediaLibrary();
    (payload as Record<string, unknown>).mode = 'merge';
  }

  const summary = await dictionaryService.importMediaLibrary(payload);
  return res.json(summary);
});

export default router;
