import { Router, Request, Response } from 'express';
import { videoService } from '../../services/video.service';
import {
  tagShortsByDuration,
  tagLongVideosByDuration,
  mergeShortTags,
} from '../../services/tag.service';
import { requireDangerousActionsEnabled } from '../../middleware/dangerousActions';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { AppError } from '../../middleware/AppError';
import batchVideoIdsSchema from '../../../schemas/request/batch-video-ids.schema.json';

const router = Router();

router.post(
  '/batch/confirm-download',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const result = await videoService.batchConfirmDownload(videoIds);
    res.json(result);
  }),
);

router.post(
  '/batch/complete',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const result = await videoService.batchComplete(videoIds);
    res.json(result);
  }),
);

router.post(
  '/batch/ignore',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const result = await videoService.batchIgnore(videoIds);
    res.json(result);
  }),
);

router.post(
  '/:id/ignore',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) {
      return res.status(400).json({ error: { message: 'Invalid video id' } });
    }
    const updated = await videoService.ignoreVideo(videoId);
    res.json(updated);
  }),
);

router.post(
  '/batch/tag-shorts-by-duration',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await tagShortsByDuration();
    res.json(summary);
  }),
);

router.post(
  '/batch/tag-long-videos-by-duration',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await tagLongVideosByDuration();
    res.json(summary);
  }),
);

router.post(
  '/batch/merge-short-tags',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await mergeShortTags();
    res.json(summary);
  }),
);

export default router;
