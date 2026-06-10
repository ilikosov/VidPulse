import { KnexChannelRepository, KnexVideoRepository } from '../../repositories/knex.repositories';
import { youtubeService } from '../youtube.service';
import { parseTitle } from '../parser/parser.service';
import { assignAutoTags } from '../tag.service';
import { logEvent } from '../eventLog.service';
import { IChannelRepository, IVideoRepository } from '../../interfaces/repositories';
import {
  IChannelSyncService,
  IEventLogger,
  IParser,
  ITagService,
  IYouTubeService,
} from '../../interfaces/services';
import { logger } from '../../lib/logger';
import { ingestVideo } from './ingestVideo';

const SYNC_INTERVAL_HOURS = 1;

export class ChannelSyncService implements IChannelSyncService {
  constructor(
    private channels: IChannelRepository,
    private videos: IVideoRepository,
    private youtube: IYouTubeService,
    private parser: IParser,
    private tags: ITagService,
    private logger: IEventLogger,
  ) {}
  async sync(): Promise<void> {
    const channels = await this.channels.getAll();
    let newVideosTotal = 0;
    let channelsProcessed = 0;
    for (const channel of channels) {
      try {
        const now = new Date();
        const lastCheckedAt = channel.last_checked_at ? new Date(channel.last_checked_at) : null;
        if (
          lastCheckedAt &&
          (now.getTime() - lastCheckedAt.getTime()) / (1000 * 60 * 60) < SYNC_INTERVAL_HOURS
        )
          continue;
        const publishedAfter = lastCheckedAt ? lastCheckedAt.toISOString() : now.toISOString();
        const items = await this.youtube.fetchChannelVideos(channel.youtube_id, publishedAfter);
        for (const item of items) {
          const id = await ingestVideo(
            { videos: this.videos, youtube: this.youtube, parser: this.parser, tags: this.tags },
            item,
            { channelId: channel.id },
          );
          if (id) newVideosTotal += 1;
        }
        await this.channels.updateLastCheckedAt(channel.id, now.toISOString());
        channelsProcessed += 1;
      } catch (e) {
        logger.error(`Error syncing channel ${channel.youtube_id}:`, e);
      }
    }
    await this.logger.logEvent(
      'sync_completed',
      `Channel sync completed. Processed ${channelsProcessed} channel(s), found ${newVideosTotal} new video(s).`,
      { syncType: 'channels', channelsProcessed, playlistsProcessed: 0, newVideosTotal },
    );
  }
}

export const channelSyncService = new ChannelSyncService(
  new KnexChannelRepository(),
  new KnexVideoRepository(),
  youtubeService,
  { parseTitle },
  { assignAutoTags },
  { logEvent },
);
