import { Request, Response, Router } from 'express';
import { fileService } from '../services/file.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../middleware/AppError';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = req.query.videoId != null ? Number(req.query.videoId) : undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const result = await fileService.getFiles({ videoId, page, limit });
    res.json(result);
  }),
);

router.post(
  '/scan',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await fileService.scan();
    res.json(result);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const file = await fileService.getFileDetails(Number(req.params.id));
    res.json(file);
  }),
);

router.get(
  '/:id/thumbnails',
  asyncHandler(async (req: Request, res: Response) => {
    const thumbnails = await fileService.getThumbnails(Number(req.params.id));
    res.json({ thumbnails });
  }),
);

// Generate preview frames from the file on disk and persist them, replacing any earlier set.
router.post(
  '/:id/thumbnails',
  asyncHandler(async (req: Request, res: Response) => {
    const thumbnails = await fileService.generatePreviews(Number(req.params.id));
    res.json({ thumbnails });
  }),
);

router.put(
  '/:id/link',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { videoId } = req.body as { videoId: number | null };
    if (videoId !== null && !Number.isInteger(videoId)) {
      throw AppError.badRequest('videoId must be an integer or null');
    }
    const file = await fileService.linkVideo(id, videoId);
    res.json(file);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await fileService.deleteFile(Number(req.params.id));
    res.json({ ok: true });
  }),
);

export default router;
