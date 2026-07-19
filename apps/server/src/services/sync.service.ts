import type { ScheduledTask } from 'node-cron';
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
  /** The live cron task, kept so a config-reload restart can tear it down (see stopScheduler). */
  private task: ScheduledTask | null = null;
  private stopRequested = false;

  constructor(
    private channelSync: IChannelSyncService,
    private playlistSync: IPlaylistSyncService,
  ) {}
  async syncAll(): Promise<void> {
    await this.channelSync.sync();
    await this.playlistSync.sync();
  }
  runScheduler(): void {
    this.stopRequested = false;
    const cronTime = config.sync.cronTime;
    import('node-cron')
      .then((cron) => {
        const task = cron.schedule(cronTime, async () => {
          try {
            await this.syncAll();
          } catch (error) {
            logger.error('Scheduled sync failed:', error);
          }
        });
        // stopScheduler() may have been called before this async import resolved.
        if (this.stopRequested) {
          task.destroy();
          return;
        }
        this.task = task;
        logger.info(`Sync scheduler started with cron pattern: ${cronTime}`);
      })
      .catch((error) => logger.error('Failed to start sync scheduler:', error));
  }

  /** Tear down the scheduled task so it can be re-registered after a config reload. */
  stopScheduler(): void {
    this.stopRequested = true;
    this.task?.destroy();
    this.task = null;
  }
}

export const syncService = new SyncService(channelSyncService, playlistSyncService);
