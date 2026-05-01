import type { IChannelSyncService, IPlaylistSyncService, ISyncService } from '../interfaces/services';
import { createAppContainer } from '../compositionRoot';

export class SyncService implements ISyncService {
  constructor(private channelSync: IChannelSyncService, private playlistSync: IPlaylistSyncService) {}
  async syncAll(): Promise<void> { await this.channelSync.sync(); await this.playlistSync.sync(); }
  runScheduler(): void {
    const cronTime = process.env.SYNC_CRON_TIME || '0 3 * * *';
    import('node-cron').then((cron) => {
      cron.schedule(cronTime, async () => {
        try { await this.syncAll(); } catch (error) { console.error('Scheduled sync failed:', error); }
      });
      console.log(`Sync scheduler started with cron pattern: ${cronTime}`);
    }).catch((error) => console.error('Failed to start sync scheduler:', error));
  }
}

export async function syncChannels(): Promise<void> { await createAppContainer().channelSync.sync(); }
export async function syncPlaylists(): Promise<void> { await createAppContainer().playlistSync.sync(); }
export function runScheduler(): void { createAppContainer().syncService.runScheduler(); }
