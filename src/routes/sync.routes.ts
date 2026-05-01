import { Router, Request, Response } from 'express';
import type { ISyncService } from '../interfaces/services';
import { createAppContainer } from '../compositionRoot';

export function createSyncRouter(syncService: ISyncService): Router {
  const router = Router();
  router.post('/trigger', async (_req: Request, res: Response) => {
    try {
      await syncService.syncAll();
      res.json({ message: 'Sync completed successfully' });
    } catch (error) {
      console.error('Error during sync:', error);
      res.status(500).json({ error: 'Sync failed' });
    }
  });
  return router;
}

export default createSyncRouter(createAppContainer().syncService);
