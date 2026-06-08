import type {
  IChannelSyncService,
  IPlaylistSyncService,
  ISyncService,
} from '../interfaces/services';
import { logger } from '../lib/logger';
import { channelSyncService } from './sync/channelSync.service';
import { playlistSyncService } from './sync/playlistSync.service';
import { config } from '../config';

export class SyncService implements ISyncService {
  constructor(
    private channelSync: IChannelSyncService,
    private playlistSync: IPlaylistSyncService,
  ) {}
  async syncAll(): Promise<void> {
    await this.channelSync.sync();
    await this.playlistSync.sync();
  }
  runScheduler(): void {
    const cronTime = config.sync.cronTime;
    import('node-cron')
      .then((cron) => {
        cron.schedule(cronTime, async () => {
          try {
            await this.syncAll();
          } catch (error) {
            logger.error('Scheduled sync failed:', error);
          }
        });
        logger.info(`Sync scheduler started with cron pattern: ${cronTime}`);
      })
      .catch((error) => logger.error('Failed to start sync scheduler:', error));
  }
}

export const syncService = new SyncService(channelSyncService, playlistSyncService);
