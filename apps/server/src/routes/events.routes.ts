import { Router } from 'express';
import knex from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const eventType = req.query.event_type as string | undefined;
    const offset = (page - 1) * limit;

    const eventsQuery = knex('event_log')
      .select('id', 'event_type', 'description', 'metadata', 'created_at')
      .orderBy('created_at', 'desc');

    const countQuery = knex('event_log');

    if (eventType) {
      eventsQuery.where('event_type', eventType);
      countQuery.where('event_type', eventType);
    }

    const events = await eventsQuery.limit(limit).offset(offset);
    const total = await countQuery.count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    res.json({
      events,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  }),
);

export default router;
