import { Router } from 'express';
import { dictionaryService } from '../services/dictionary.service';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import settingsSchema from '../../schemas/request/settings.schema.json';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await dictionaryService.getAllSettings();
    res.json(settings);
  }),
);

router.put(
  '/',
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const { key, value } = req.body as { key: string; value: string };
    await dictionaryService.upsertSetting(key, value);
    return res.json({ key, value });
  }),
);

export default router;
