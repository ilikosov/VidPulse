import { Router, Request, Response } from 'express';
import { syncChannels, syncPlaylists } from '../services/sync.service';

const router = Router();

// POST /api/sync/trigger - Manually trigger sync for all channels and playlists
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    await syncChannels();
    await syncPlaylists();
    res.json({ message: 'Sync completed successfully' });
  } catch (error) {
    console.error('Error during sync:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
