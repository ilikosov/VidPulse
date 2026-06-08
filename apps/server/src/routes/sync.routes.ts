import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { syncService } from '../services/sync.service';

const router = Router();

router.post(
  '/trigger',
  asyncHandler(async (_req: Request, res: Response) => {
    await syncService.syncAll();
    res.json({ message: 'Sync completed successfully' });
  }),
);

export default router;
