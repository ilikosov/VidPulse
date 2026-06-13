import { Router } from 'express';
import { config } from '../config';
import { settingsService } from '../services/dictionary';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import settingsSchema from '../../schemas/request/settings.schema.json';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getAllSettings();
    // Expose the env-driven pagination size alongside DB settings (read-only).
    res.json({ ...settings, page_size: String(config.pageSize) });
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
