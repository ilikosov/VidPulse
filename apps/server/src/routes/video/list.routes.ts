import { Router, Request, Response } from 'express';
import { videoService } from '../../services/video.service';
import { asyncHandler } from '../../middleware/asyncHandler';
import { buildPaginationMeta, getPaginationParams } from '../pagination';
import { AppError } from '../../middleware/AppError';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const status = req.query.status as string | undefined;
    const includeIgnored = req.query.includeIgnored === 'true';
    const channelId = req.query.channel_id as string | undefined;
    const playlistId = req.query.playlist_id as string | undefined;
    const videoListId = req.query.video_list_id as string | undefined;
    const search = req.query.search as string | undefined;

    const result = await videoService.getVideos(
      { status, includeIgnored, channelId, playlistId, videoListId, search },
      { page, limit, offset },
    );

    res.json({
      videos: result.videos,
      pagination: buildPaginationMeta(page, limit, result.pagination.total),
    });
  }),
);

export default router;
