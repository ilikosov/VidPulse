import { Router, Request, Response } from 'express';
import { errorLogRepository } from '@vidpulse/db';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const errors = await errorLogRepository.findAll(limit, offset);
    const total = await errorLogRepository.count();
    const totalPages = Math.ceil(total / limit);

    res.json({ errors, pagination: { page, limit, total, totalPages } });
  }),
);

router.delete(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    await errorLogRepository.clear();
    res.json({ ok: true });
  }),
);

export default router;
