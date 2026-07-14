import { Router, Request, Response } from 'express';
import { videoService } from '../../services/video.service';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validateBody, validateParams } from '../../middleware/validate';
import { AppError } from '../../middleware/AppError';
import batchTagsSchema from '../../../schemas/request/batch-tags.schema.json';
import videoTagsSchema from '../../../schemas/request/video-tags.schema.json';
import paramsIdSchema from '../../../schemas/request/params-id.schema.json';

const router = Router();

// Static /batch/tags routes MUST be registered before the parameterized /:id/tags ones:
// Express matches in registration order, so '/:id/tags' would otherwise capture
// 'batch' as :id and validateParams would reject every batch request with a 400.
router.post(
  '/batch/tags',
  validateBody(batchTagsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { videoIds, tagName, confirm } = req.body as {
      videoIds: number[];
      tagName: string;
      confirm?: boolean;
    };
    const result = await videoService.batchAddTags(videoIds, tagName, confirm);
    res.json(result);
  }),
);

router.delete(
  '/batch/tags',
  validateBody(batchTagsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { videoIds, tagName } = req.body as { videoIds: number[]; tagName: string };
    const result = await videoService.batchRemoveTags(videoIds, tagName);
    res.json(result);
  }),
);

router.get(
  '/:id/tags',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    const tags = await videoService.getVideoTags(videoId);
    res.json(tags);
  }),
);

router.post(
  '/:id/tags',
  validateParams(paramsIdSchema),
  validateBody(videoTagsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    const { name: tagName, confirm } = req.body as { name: string; confirm?: boolean };
    const tag = await videoService.addVideoTag(videoId, tagName, confirm);
    res.status(201).json(tag);
  }),
);

router.delete(
  '/:id/tags/:tagId',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    const tagId = Number(req.params.tagId);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    if (!Number.isInteger(tagId) || tagId <= 0) throw AppError.badRequest('Invalid tag id');
    await videoService.removeVideoTag(videoId, tagId);
    res.status(204).send();
  }),
);

export default router;
