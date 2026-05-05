import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dictionaryService } from '../services/dictionary.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
type TemplateEntity = 'groups' | 'artists' | 'songs' | 'events';
type TemplateFormat = 'csv' | 'json';
type AliasEntityType = 'group' | 'artist' | 'song';
const aliasEntityMap: Record<string, AliasEntityType> = {
  group: 'group',
  groups: 'group',
  artist: 'artist',
  artists: 'artist',
  song: 'song',
  songs: 'song',
};

const dictionaryTemplates: Record<TemplateEntity, Record<string, string>> = {
  groups: { name: '', type: 'female' },
  artists: { name: '', group_name: '' },
  songs: { title: '', artist: '' },
  events: { name: '' },
};

const createCsvTemplate = (entity: TemplateEntity): string =>
  `${Object.keys(dictionaryTemplates[entity]).join(',')}\n`;

const parseCsv = (text: string) => {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = header.split(',').map((c) => c.trim());
  return lines.map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return cols.reduce<Record<string, string>>((acc, col, i) => {
      acc[col] = values[i] ?? '';
      return acc;
    }, {});
  });
};

router.get('/groups/list', async (req, res) =>
  res.json(
    await dictionaryService.getGroups(
      req.query.type as string | undefined,
      req.query.q as string | undefined,
      Number(req.query.limit) || 20,
    ),
  ),
);
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

router.get('/artists/list', async (req, res) =>
  res.json(
    await dictionaryService.getArtists(
      req.query.group_id ? Number(req.query.group_id) : undefined,
      req.query.q as string | undefined,
      Number(req.query.limit) || 20,
    ),
  ),
);
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

router.get('/songs/list', async (req, res) =>
  res.json(
    await dictionaryService.getSongs(
      req.query.q as string | undefined,
      Number(req.query.limit) || 20,
    ),
  ),
);
router.post('/songs', async (req, res) => {
  const { title, artist } = req.body;
  if (!title || !artist) return res.status(400).json({ error: 'title and artist are required' });
  await dictionaryService.createSong({ title, artist });
  res.status(201).json({ ok: true });
});
router.put('/songs/:id', async (req, res) => {
  await dictionaryService.updateSong(Number(req.params.id), req.body);
  res.json({ ok: true });
});
router.delete('/songs/:id', async (req, res) => {
  await dictionaryService.deleteSong(Number(req.params.id));
  res.status(204).send();
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
  return res.json(await dictionaryService.getVideosByField('group_name', group.name, page, limit));
});

router.get('/artists/:id', async (req, res) => {
  const artist = await dictionaryService.getArtistById(Number(req.params.id));
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  return res.json(artist);
});

router.get('/artists/:id/videos', async (req, res) => {
  const artist = await dictionaryService.getArtistById(Number(req.params.id));
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  return res.json(
    await dictionaryService.getVideosByField('artist_name', artist.name, page, limit),
  );
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
  return res.json(await dictionaryService.getVideosByField('song_title', song.title, page, limit));
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

router.get('/events/list', async (req, res) =>
  res.json(
    await dictionaryService.getEvents(
      req.query.q as string | undefined,
      Number(req.query.limit) || 20,
    ),
  ),
);
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

router.get('/template/:entity/:format', (req, res) => {
  const entity = req.params.entity as TemplateEntity;
  const format = req.params.format as TemplateFormat;

  if (!dictionaryTemplates[entity]) return res.status(400).json({ error: 'unsupported entity' });
  if (!['csv', 'json'].includes(format))
    return res.status(400).json({ error: 'unsupported format' });

  const filename = `template_${entity}.${format}`;
  const payload =
    format === 'csv'
      ? createCsvTemplate(entity)
      : `${JSON.stringify([dictionaryTemplates[entity]], null, 2)}\n`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.type(format === 'csv' ? 'text/csv' : 'application/json');
  return res.send(payload);
});

router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const name = req.file.originalname.toLowerCase();
  const raw = req.file.buffer.toString('utf-8');
  let records: Record<string, unknown>[] = [];
  if (name.endsWith('.json')) records = JSON.parse(raw);
  else if (name.endsWith('.csv')) records = parseCsv(raw);
  else return res.status(400).json({ error: 'unsupported file format' });
  const summary = await dictionaryService.importRecords(records);
  return res.json(summary);
});

export default router;
