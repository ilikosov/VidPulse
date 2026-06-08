import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { checkYouTubeApiConnectivity } from '../services/youtube.service';

const router = Router();

router.get(
  '/youtube',
  asyncHandler(async (_req, res) => {
    const result = await checkYouTubeApiConnectivity();
    res.status(result.ok ? 200 : 502).json(result);
  }),
);

export default router;
