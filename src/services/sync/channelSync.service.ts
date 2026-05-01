import { IChannelRepository, IVideoRepository } from '../../interfaces/repositories';
import { IChannelSyncService, IEventLogger, IParser, ITagService, IYouTubeService } from '../../interfaces/services';
import { parseVideoMetadata } from './metadata.utils';

const SYNC_INTERVAL_HOURS = 1;

export class ChannelSyncService implements IChannelSyncService {
  constructor(private channels: IChannelRepository, private videos: IVideoRepository, private youtube: IYouTubeService, private parser: IParser, private tags: ITagService, private logger: IEventLogger) {}
  async sync(): Promise<void> {
    const channels = await this.channels.getAll();
    let newVideosTotal = 0; let channelsProcessed = 0;
    for (const channel of channels) {
      try {
        const now = new Date();
        const lastCheckedAt = channel.last_checked_at ? new Date(channel.last_checked_at) : null;
        if (lastCheckedAt && (now.getTime()-lastCheckedAt.getTime())/(1000*60*60) < SYNC_INTERVAL_HOURS) continue;
        const publishedAfter = lastCheckedAt ? lastCheckedAt.toISOString() : now.toISOString();
        const items = await this.youtube.fetchChannelVideos(channel.youtube_id, publishedAfter);
        for (const item of items) {
          if (await this.videos.findByYoutubeId(item.videoId)) continue;
          const details = await this.youtube.getVideoDetails(item.videoId);
          const { metadata, status } = await parseVideoMetadata(this.parser, details.title || item.title, details.publishedAt || item.publishedAt, details.tags);
          const id = await this.videos.insert({ youtube_id: item.videoId, channel_id: channel.id, original_title: details.title || item.title, published_at: details.publishedAt || item.publishedAt, duration_seconds: details.durationSeconds ?? null, status, ...metadata, created_at: now.toISOString(), updated_at: now.toISOString() });
          await this.tags.assignAutoTags(id, details.durationSeconds, details.privacyStatus);
          newVideosTotal += 1;
        }
        await this.channels.updateLastCheckedAt(channel.id, now.toISOString());
        channelsProcessed += 1;
      } catch (e) { console.error(`Error syncing channel ${channel.youtube_id}:`, e); }
    }
    await this.logger.logEvent('sync_completed', `Channel sync completed. Processed ${channelsProcessed} channel(s), found ${newVideosTotal} new video(s).`, { syncType: 'channels', channelsProcessed, playlistsProcessed: 0, newVideosTotal });
  }
}
