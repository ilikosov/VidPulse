import { IPlaylistRepository, IVideoRepository } from '../../interfaces/repositories';
import { IEventLogger, IParser, IPlaylistSyncService, ITagService, IYouTubeService } from '../../interfaces/services';
import { parseVideoMetadata } from './metadata.utils';

export class PlaylistSyncService implements IPlaylistSyncService {
  constructor(private playlists: IPlaylistRepository, private videos: IVideoRepository, private youtube: IYouTubeService, private parser: IParser, private tags: ITagService, private logger: IEventLogger) {}
  async sync(): Promise<void> {
    const playlists = await this.playlists.getAll();
    let newVideosTotal = 0; let playlistsProcessed = 0;
    for (const playlist of playlists) {
      try {
        const existing = await this.videos.findYoutubeIdsByPlaylistId(playlist.id);
        const items = await this.youtube.fetchPlaylistItems(playlist.youtube_id);
        for (const item of items.filter((v)=>!existing.has(v.videoId))) {
          if (await this.videos.findByYoutubeId(item.videoId)) continue;
          const details = await this.youtube.getVideoDetails(item.videoId);
          const { metadata, status } = await parseVideoMetadata(this.parser, details.title || item.title, details.publishedAt || item.publishedAt, details.tags);
          const id = await this.videos.insert({ youtube_id: item.videoId, playlist_id: playlist.id, original_title: details.title || item.title, published_at: details.publishedAt || item.publishedAt, duration_seconds: details.durationSeconds ?? null, status, ...metadata, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          await this.tags.assignAutoTags(id, details.durationSeconds, details.privacyStatus);
          newVideosTotal += 1;
        }
        await this.playlists.updateLastCheckedAt(playlist.id, new Date().toISOString());
        playlistsProcessed += 1;
      } catch (e) { console.error(`Error syncing playlist ${playlist.youtube_id}:`, e); }
    }
    await this.logger.logEvent('sync_completed', `Playlist sync completed. Processed ${playlistsProcessed} playlist(s), found ${newVideosTotal} new video(s).`, { syncType: 'playlists', channelsProcessed: 0, playlistsProcessed, newVideosTotal });
  }
}
