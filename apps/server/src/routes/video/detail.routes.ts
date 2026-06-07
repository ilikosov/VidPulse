import { Router, Request, Response } from 'express';
import { videoService } from '../../services/video.service';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validateBody } from '../../middleware/validate';
import videoAddSchema from '../../../schemas/request/video-add.schema.json';

const router = Router();

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: { message: 'Invalid video id' } });
    }
    const video = await videoService.getVideoById(id);
    res.json(video);
  }),
);

router.post(
  '/add',
  validateBody(videoAddSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { url } = req.body as { url: string };
    const created = await videoService.addVideo(url);
    res.status(201).json(created);
  }),
);

export default router;
