import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requestLogService } from '../services/requestLog.service';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ requests: requestLogService.getAll() });
  }),
);

router.delete(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    requestLogService.clear();
    res.json({ ok: true });
  }),
);

export default router;
