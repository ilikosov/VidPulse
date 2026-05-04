import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dictionaryService } from '../services/dictionary.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const parseCsv = (text: string) => {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = header.split(',').map((c) => c.trim());
  return lines.map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return cols.reduce<Record<string, string>>((acc, col, i) => { acc[col] = values[i] ?? ''; return acc; }, {});
  });
};

router.get('/groups/list', async (req, res) => res.json(await dictionaryService.getGroups(req.query.type as string | undefined, req.query.q as string | undefined)));
router.post('/groups', async (req, res) => { const { name, type, active } = req.body; if (!name || !type) return res.status(400).json({ error: 'name and type are required' }); await dictionaryService.createGroup({ name, type, active }); res.status(201).json({ ok: true }); });
router.put('/groups/:id', async (req, res) => { await dictionaryService.updateGroup(Number(req.params.id), req.body); res.json({ ok: true }); });
router.delete('/groups/:id', async (req, res) => { await dictionaryService.deleteGroup(Number(req.params.id)); res.status(204).send(); });

router.get('/artists/list', async (req, res) => res.json(await dictionaryService.getArtists(req.query.group_id ? Number(req.query.group_id) : undefined, req.query.q as string | undefined)));
router.post('/artists', async (req, res) => { const { name, group_id } = req.body; if (!name || !group_id) return res.status(400).json({ error: 'name and group_id are required' }); await dictionaryService.createArtist({ name, group_id: Number(group_id) }); res.status(201).json({ ok: true }); });
router.put('/artists/:id', async (req, res) => { await dictionaryService.updateArtist(Number(req.params.id), { name: req.body.name, group_id: Number(req.body.group_id) }); res.json({ ok: true }); });
router.delete('/artists/:id', async (req, res) => { await dictionaryService.deleteArtist(Number(req.params.id)); res.status(204).send(); });

router.get('/songs/list', async (req, res) => res.json(await dictionaryService.getSongs(req.query.q as string | undefined)));
router.post('/songs', async (req, res) => { const { title, artist } = req.body; if (!title || !artist) return res.status(400).json({ error: 'title and artist are required' }); await dictionaryService.createSong({ title, artist }); res.status(201).json({ ok: true }); });
router.put('/songs/:id', async (req, res) => { await dictionaryService.updateSong(Number(req.params.id), req.body); res.json({ ok: true }); });
router.delete('/songs/:id', async (req, res) => { await dictionaryService.deleteSong(Number(req.params.id)); res.status(204).send(); });

router.get('/events/list', async (req, res) => res.json(await dictionaryService.getEvents(req.query.q as string | undefined)));
router.post('/events', async (req, res) => { if (!req.body.name) return res.status(400).json({ error: 'name is required' }); await dictionaryService.createEvent({ name: req.body.name }); res.status(201).json({ ok: true }); });
router.put('/events/:id', async (req, res) => { await dictionaryService.updateEvent(Number(req.params.id), req.body); res.json({ ok: true }); });
router.delete('/events/:id', async (req, res) => { await dictionaryService.deleteEvent(Number(req.params.id)); res.status(204).send(); });

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
