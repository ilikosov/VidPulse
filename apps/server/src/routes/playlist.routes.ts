import { Router, Request, Response } from 'express';
import { playlistService } from '../services/playlist.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { buildPaginationMeta } from './pagination';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/AppError';
import playlistSchema from '../../schemas/request/playlist.schema.json';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const result = await playlistService.getPlaylists(page, limit);
    res.json({
      playlists: result.playlists,
      pagination: buildPaginationMeta(page, limit, result.pagination.total),
    });
  }),
);

router.post(
  '/',
  validateBody(playlistSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { url } = req.body as { url: string };
    const newPlaylist = await playlistService.addPlaylist(url);
    res.status(201).json(newPlaylist);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid playlist id');
    const removeVideos = req.query.removeVideos === 'true';
    await playlistService.deletePlaylist(id, removeVideos);
    res.status(204).send();
  }),
);

export default router;
