import { Request, Response, Router } from 'express';
import { videoListService } from '../services/video-list.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody, validateParams } from '../middleware/validate';
import { getPaginationParams } from './pagination';
import videoListSchema from '../../schemas/request/video-list.schema.json';
import videoListVideosSchema from '../../schemas/request/video-list-videos.schema.json';
import videoListPatchSchema from '../../schemas/request/video-list-patch.schema.json';
import paramsIdSchema from '../../schemas/request/params-id.schema.json';

const router = Router();

router.post(
  '/',
  validateBody(videoListSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, videoIds } = req.body as { name: string; videoIds?: number[] };
    const created = await videoListService.create(name, videoIds);
    res.status(201).json(created);
  }),
);

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const lists = await videoListService.getAll();
    res.json(lists);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { page, limit } = getPaginationParams(req, 20, 100);
    const duplicatesOnly = req.query.duplicatesOnly === 'true';
    const list = await videoListService.getById(id, { page, limit, duplicatesOnly });
    res.json(list);
  }),
);

router.post(
  '/:id/videos',
  validateParams(paramsIdSchema),
  validateBody(videoListVideosSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const videoIds: number[] = req.body.videoIds;
    const result = await videoListService.addVideos(id, videoIds);
    res.json(result);
  }),
);

router.delete(
  '/:id/videos',
  validateParams(paramsIdSchema),
  validateBody(videoListVideosSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const videoIds: number[] = req.body.videoIds;
    const result = await videoListService.removeVideos(id, videoIds);
    res.json(result);
  }),
);

router.patch(
  '/:id',
  validateParams(paramsIdSchema),
  validateBody(videoListPatchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const name: string = req.body.name;
    const result = await videoListService.updateName(id, name);
    res.json(result);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await videoListService.delete(id);
    res.json(result);
  }),
);

router.post(
  '/:id/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const operation = req.body?.operation;
    const videoIds = req.body?.videoIds;
    const tagName = req.body?.tagName;
    const confirm = req.body?.confirm;
    const result = await videoListService.batchOperation(id, operation, videoIds, tagName, confirm);
    res.json(result);
  }),
);

export default router;
