import { Router, Request, Response } from 'express';
import { videoService } from '../../services/video.service';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AppError } from '../../middleware/AppError';

const router = Router();

router.put(
  '/:id/metadata',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid video id');

    const { perf_date, group_name, artist_name, song_title, song_titles, event, camera_type } =
      req.body;

    const updated = await videoService.updateMetadata(id, {
      perf_date,
      group_name,
      artist_name,
      song_title,
      song_titles,
      event,
      camera_type,
    });

    res.json(updated);
  }),
);

router.post(
  '/:id/suggest',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    const suggestion = await videoService.suggestMetadata(videoId);
    res.json(suggestion);
  }),
);

router.post(
  '/:id/resync',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId <= 0) throw AppError.badRequest('Invalid video id');
    const result = await videoService.resyncVideo(videoId);
    res.json(result);
  }),
);

router.post(
  '/:id/parse',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid video id');
    const result = await videoService.reparseVideo(id);
    res.json(result);
  }),
);

export default router;
