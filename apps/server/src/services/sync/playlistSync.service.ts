import { KnexPlaylistRepository, KnexVideoRepository } from '@vidpulse/db';
import { youtubeService } from '../youtube.service';
import { parseTitle } from '../parseTitle';
import { assignAutoTags } from '../tag.service';
import { logEvent } from '../eventLog.service';
import { IPlaylistRepository, IVideoRepository } from '@vidpulse/db';
import {
  IEventLogger,
  IParser,
  IPlaylistSyncService,
  ITagService,
  IYouTubeService,
} from '../../interfaces/services';
import { logger } from '../../lib/logger';
import { ingestVideo } from './ingestVideo';

export class PlaylistSyncService implements IPlaylistSyncService {
  constructor(
    private playlists: IPlaylistRepository,
    private videos: IVideoRepository,
    private youtube: IYouTubeService,
    private parser: IParser,
    private tags: ITagService,
    private logger: IEventLogger,
  ) {}
  async sync(): Promise<void> {
    const playlists = await this.playlists.getAll();
    let newVideosTotal = 0;
    let playlistsProcessed = 0;
    for (const playlist of playlists) {
      try {
        const existing = await this.videos.findYoutubeIdsByPlaylistId(playlist.id);
        const items = await this.youtube.fetchPlaylistItems(playlist.youtube_id);
        for (const item of items.filter((v) => !existing.has(v.videoId))) {
          const id = await ingestVideo(
            { videos: this.videos, youtube: this.youtube, parser: this.parser, tags: this.tags },
            item,
            { playlistId: playlist.id },
          );
          if (id) newVideosTotal += 1;
        }
        await this.playlists.updateLastCheckedAt(playlist.id, new Date().toISOString());
        playlistsProcessed += 1;
      } catch (e) {
        logger.error(`Error syncing playlist ${playlist.youtube_id}:`, e);
      }
    }
    await this.logger.logEvent(
      'sync_completed',
      `Playlist sync completed. Processed ${playlistsProcessed} playlist(s), found ${newVideosTotal} new video(s).`,
      { syncType: 'playlists', channelsProcessed: 0, playlistsProcessed, newVideosTotal },
    );
  }
}

export const playlistSyncService = new PlaylistSyncService(
  new KnexPlaylistRepository(),
  new KnexVideoRepository(),
  youtubeService,
  { parseTitle },
  { assignAutoTags },
  { logEvent },
);
