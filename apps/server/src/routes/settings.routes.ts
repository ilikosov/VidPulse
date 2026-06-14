import { Router } from 'express';
import { settingsService } from '../services/dictionary';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import settingsSchema from '../../schemas/request/settings.schema.json';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getAllSettings();
    res.json(settings);
  }),
);

router.put(
  '/',
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const { key, value } = req.body as { key: string; value: string };
    await settingsService.upsertSetting(key, value);
    return res.json({ key, value });
  }),
);

export default router;
