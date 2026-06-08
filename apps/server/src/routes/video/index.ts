import { Router } from 'express';
import listRouter from './list.routes';
import detailRouter from './detail.routes';
import metadataRouter from './metadata.routes';
import tagsRouter from './tags.routes';
import batchRouter from './batch.routes';

const router = Router();

router.use(listRouter);
router.use(detailRouter);
router.use(metadataRouter);
router.use(tagsRouter);
router.use(batchRouter);

export default router;
