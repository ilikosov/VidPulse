import { Router, Request, Response } from 'express';
import { dictionaryService } from '../services/dictionary.service';

const router = Router();

router.get('/groups', async (req: Request, res: Response) => {
  const rows = await dictionaryService.getGroups(req.query.type as string | undefined, req.query.q as string | undefined);
  res.json({ results: rows });
});

router.get('/artists', async (req: Request, res: Response) => {
  const groupId = req.query.group_id ? Number(req.query.group_id) : undefined;
  const rows = await dictionaryService.getArtists(groupId, req.query.q as string | undefined);
  res.json({ results: rows });
});

router.get('/songs', async (req: Request, res: Response) => {
  const rows = await dictionaryService.getSongs(req.query.q as string | undefined);
  res.json({ results: rows });
});

router.get('/events', async (req: Request, res: Response) => {
  const rows = await dictionaryService.getEvents(req.query.q as string | undefined);
  res.json({ results: rows });
});

router.get('/', async (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  const q = req.query.q as string | undefined;
  if (!type) return res.status(400).json({ error: 'Missing required query parameter: type' });

  if (type === 'groups') {
    const rows = await dictionaryService.getGroups(undefined, q);
    return res.json({ results: rows.map((r) => r.name), type, query: q || '' });
  }
  if (type === 'artists') {
    const rows = await dictionaryService.getArtists(undefined, q);
    return res.json({ results: rows.map((r) => r.name), type, query: q || '' });
  }
  if (type === 'songs') {
    const rows = await dictionaryService.getSongs(q);
    return res.json({ results: rows.map((r) => r.title), type, query: q || '' });
  }
  if (type === 'events') {
    const rows = await dictionaryService.getEvents(q);
    return res.json({ results: rows.map((r) => r.name), type, query: q || '' });
  }

  return res.status(400).json({ error: 'Invalid type' });
});

export default router;
