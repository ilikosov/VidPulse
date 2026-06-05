import { Router } from 'express';
import { dictionaryService } from '../services/dictionary.service';
import { validateBody } from '../middleware/validate';
import settingsSchema from '../schemas/request/settings.schema.json';

const router = Router();

router.get('/', async (_req, res) => {
  const settings = await dictionaryService.getAllSettings();
  res.json(settings);
});

router.put('/', validateBody(settingsSchema), async (req, res) => {
  const { key, value } = req.body as { key: string; value: string };
  await dictionaryService.upsertSetting(key, value);
  return res.json({ key, value });
});

export default router;
