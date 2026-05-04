import { Router } from 'express';
import { dictionaryService } from '../services/dictionary.service';

const router = Router();

router.get('/', async (_req, res) => {
  const settings = await dictionaryService.getAllSettings();
  res.json(settings);
});

router.put('/', async (req, res) => {
  const { key, value } = req.body ?? {};
  if (!key || typeof key !== 'string' || typeof value !== 'string') {
    return res.status(400).json({ error: 'key and value are required strings' });
  }
  await dictionaryService.upsertSetting(key, value);
  return res.json({ key, value });
});

export default router;
