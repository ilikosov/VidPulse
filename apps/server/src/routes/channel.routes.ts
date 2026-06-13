import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';
import { channelService } from '../services/channel.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { buildPaginationMeta } from './pagination';
import { validateBody, validateParams } from '../middleware/validate';
import { AppError } from '../middleware/AppError';
import channelSchema from '../../schemas/request/channel.schema.json';
import paramsIdSchema from '../../schemas/request/params-id.schema.json';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file, cb) => {
    const isTxtFile = file.originalname.toLowerCase().endsWith('.txt');
    const isTextMimeType = file.mimetype.startsWith('text/');
    if (isTxtFile || isTextMimeType) {
      cb(null, true);
      return;
    }
    cb(new Error('Only text (.txt) files are allowed'));
  },
});

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || config.pageSize, 100);
    const result = await channelService.getChannels(page, limit);
    res.json({
      channels: result.channels,
      pagination: buildPaginationMeta(page, limit, result.pagination.total),
    });
  }),
);

router.post(
  '/',
  validateBody(channelSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { url } = req.body as { url: string };
    const newChannel = await channelService.addChannelByUrl(url);
    res.status(201).json(newChannel);
  }),
);

router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw AppError.badRequest('File is required');

    const lines = file.buffer
      .toString('utf-8')
      .split(/\r?\n/)
      .map((line: string) => line.trim());

    const importUrls = lines.filter((line: string) => line.length > 0 && !line.startsWith('#'));
    const result = await channelService.importChannels(importUrls);
    res.json(result);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid channel id');
    const channel = await channelService.getChannelDetails(id);
    res.json(channel);
  }),
);

router.post(
  '/:id/load-more',
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid channel id');

    const countFromQuery = Number(req.query.count);
    const countFromBody = Number(req.body?.count);
    const count =
      Number.isFinite(countFromQuery) && countFromQuery > 0
        ? countFromQuery
        : Number.isFinite(countFromBody) && countFromBody > 0
          ? countFromBody
          : 50;

    const result = await channelService.loadMoreVideos(id, count);
    res.json(result);
  }),
);

router.delete(
  '/:id',
  validateParams(paramsIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const removeVideos = req.query.removeVideos === 'true';
    await channelService.deleteChannel(id, removeVideos);
    res.status(204).send();
  }),
);

export default router;
