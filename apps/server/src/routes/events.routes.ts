import { Router, Request, Response } from 'express';
import { eventLogRepository } from '../repositories/knex.repositories';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const eventType = req.query.event_type as string | undefined;
    const offset = (page - 1) * limit;

    const events = await eventLogRepository.findAll(limit, offset, eventType);
    const total = await eventLogRepository.count(eventType);
    const totalPages = Math.ceil(total / limit);

    res.json({
      events,
      pagination: { page, limit, total, totalPages },
    });
  }),
);

export default router;
