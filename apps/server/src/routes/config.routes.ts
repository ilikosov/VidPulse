import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { config } from '../config';

const router = Router();

// Whitelisted server flags the frontend needs at runtime (config lives server-side in
// vidpulse.config.yaml and can't be read by the browser). Never expose secrets here.
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      monitorEnabled: config.monitorEnabled,
      dangerousActionsEnabled: config.dangerousActionsEnabled,
    });
  }),
);

export default router;
