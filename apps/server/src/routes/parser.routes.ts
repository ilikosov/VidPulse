import { Router, Request, Response } from 'express';
import { parserService } from '../services/parser.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody, validateParams } from '../middleware/validate';
import parserLlmBatchSchema from '../../schemas/request/parser-llm-batch.schema.json';
import batchVideoIdsSchema from '../../schemas/request/batch-video-ids.schema.json';
import paramsIdSchema from '../../schemas/request/params-id.schema.json';
import { AppError } from '../middleware/AppError';

const router = Router();

router.post(
  '/llm-parse/:id',
  validateParams(paramsIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await parserService.llmParseVideo(id);
    res.json(result);
  }),
);

router.post(
  '/llm-parse-batch',
  validateBody(parserLlmBatchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const result = await parserService.llmParseBatch(videoIds);
    res.json(result);
  }),
);

router.post(
  '/reparse-all',
  asyncHandler(async (req: Request, res: Response) => {
    const status = (req.query.status as string) || 'new';
    const result = await parserService.reparseAll(status);
    res.json(result);
  }),
);

router.post(
  '/reparse/:id',
  validateParams(paramsIdSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoId = Number(req.params.id);
    const result = await parserService.reparseVideo(videoId);
    res.json(result);
  }),
);

router.post(
  '/reparse-batch',
  validateBody(batchVideoIdsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const videoIds: number[] = req.body.videoIds;
    const result = await parserService.reparseBatch(videoIds);
    res.json(result);
  }),
);

export default router;
