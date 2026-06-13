import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { kpopDictionaryService } from '../services/kpopDictionary.service';
import { AppError } from '../middleware/AppError';

const router = Router();

/**
 * Trigger a K-pop dictionary refresh from external sources now.
 * Body: { mode?: 'merge' | 'replace' } (default 'merge'; 'replace' needs the
 * dangerous-actions flag). Returns the import summary.
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const mode = (req.body as { mode?: string } | undefined)?.mode;
    if (mode !== undefined && mode !== 'merge' && mode !== 'replace') {
      throw AppError.badRequest("mode must be 'merge' or 'replace'");
    }
    const summary = await kpopDictionaryService.refresh({ mode: mode as 'merge' | 'replace' });
    res.json({ summary });
  }),
);

export default router;
