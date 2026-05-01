/** Composition root: central place where concrete implementations are wired to interfaces. */
import { YouTubeService, youtubeService } from './services/youtube.service';
import { logEvent } from './services/eventLog.service';
import { assignAutoTags } from './services/tag.service';
import { parseTitle } from './services/parser/parser.service';
import { KnexChannelRepository, KnexPlaylistRepository, KnexVideoRepository } from './repositories/knex.repositories';
import { ChannelSyncService } from './services/sync/channelSync.service';
import { PlaylistSyncService } from './services/sync/playlistSync.service';
import { SyncService } from './services/sync.service';

export function createAppContainer() {
  const channelRepo = new KnexChannelRepository();
  const playlistRepo = new KnexPlaylistRepository();
  const videoRepo = new KnexVideoRepository();

  const eventLogger = { logEvent };
  const tagService = { assignAutoTags };
  const parser = { parseTitle };
  const yt = (youtubeService ?? new YouTubeService());

  const channelSync = new ChannelSyncService(channelRepo, videoRepo, yt, parser, tagService, eventLogger);
  const playlistSync = new PlaylistSyncService(playlistRepo, videoRepo, yt, parser, tagService, eventLogger);
  const syncService = new SyncService(channelSync, playlistSync);

  return { channelSync, playlistSync, syncService };
}
