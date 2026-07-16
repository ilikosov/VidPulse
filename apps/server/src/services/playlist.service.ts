import { knex } from '@vidpulse/db';
import { youtubeService } from './youtube.service';
import { logEvent } from './eventLog.service';
import { parseTitle } from './parseTitle';
import { resolveParsedMetadata, hasUnresolvedEntity } from './metadataResolver.service';
import { syncVideoSongs } from './videoSongs.service';
import { playlistRepository } from '@vidpulse/db';
import { AppError } from '../middleware/AppError';
import type { VideoInfo } from '../models/youtube.types';

/** Number of playlist items pulled per "page" — on add and per "load older" click. */
const PLAYLIST_PAGE_SIZE = 50;

class PlaylistService {
  async getPlaylists(
    page: number,
    limit: number,
  ): Promise<{
    playlists: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const offset = (page - 1) * limit;
    const playlists = await playlistRepository.findAllPaginated(limit, offset);
    const total = await playlistRepository.count();
    const totalPages = Math.ceil(total / limit);
    return {
      playlists,
      pagination: { page, limit, total, totalPages },
    };
  }

  async addPlaylist(url: string) {
    const playlistId = youtubeService.getPlaylistIdFromUrl(url);

    const existingPlaylist = await playlistRepository.findByYoutubeId(playlistId);
    if (existingPlaylist) {
      throw new AppError(409, 'Playlist already exists', 'CONFLICT');
    }

    const playlistDetails = await youtubeService.getPlaylistDetails(playlistId);

    const newPlaylistId = await playlistRepository.insert({
      youtube_id: playlistId,
      title: playlistDetails.title,
      added_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    } as any);

    const newPlaylist = await playlistRepository.findById(newPlaylistId);

    await logEvent('playlist_added', `Added playlist ${playlistDetails.title} (${playlistId})`, {
      youtube_id: playlistId,
      title: playlistDetails.title,
      playlist_id: newPlaylistId,
    });

    // Only pull the latest page of items on add; older videos are fetched on demand via
    // loadMoreVideos. Persist the cursor so "load older" can resume where this stopped.
    const { videos, nextPageToken } = await this.fetchPlaylistBatch(
      playlistId,
      undefined,
      PLAYLIST_PAGE_SIZE,
    );

    await this.ingestPlaylistVideos(newPlaylistId, videos);
    await knex('playlists')
      .where('id', newPlaylistId)
      .update({ next_page_token: nextPageToken ?? null });

    return newPlaylist;
  }

  /**
   * Fetch playlist items page-by-page until at least `count` are collected (or the playlist
   * ends). Returns the items and the cursor for the next batch (undefined when exhausted).
   */
  private async fetchPlaylistBatch(
    youtubeId: string,
    startToken: string | undefined,
    count: number,
  ): Promise<{ videos: VideoInfo[]; nextPageToken?: string }> {
    const collected: VideoInfo[] = [];
    let token = startToken;
    do {
      const page = await youtubeService.fetchPlaylistItemsPage(youtubeId, token);
      collected.push(...page.videos);
      token = page.nextPageToken;
    } while (token && collected.length < count);
    return { videos: collected, nextPageToken: token };
  }

  /**
   * Link/insert a batch of playlist items. Skips items already linked to this playlist,
   * links existing videos via the junction table, and parses+inserts brand-new ones.
   * Parse/resolve read the dictionary via the global knex pool, so they must run BEFORE the
   * write transaction opens — running them while a trx holds SQLite's single write connection
   * deadlocks the pool until acquireConnectionTimeout (~60s) → KnexTimeoutError.
   */
  private async ingestPlaylistVideos(
    playlistDbId: number,
    videos: VideoInfo[],
  ): Promise<{ loaded: number; linked: number }> {
    const linkedIds = (await knex('videos')
      .join('video_playlists', 'videos.id', 'video_playlists.video_id')
      .where('video_playlists.playlist_id', playlistDbId)
      .pluck('videos.youtube_id')) as string[];
    const linkedSet = new Set(linkedIds);
    const candidates = videos.filter((v) => !linkedSet.has(v.videoId));

    const existingByYoutubeId = new Map<string, { id: number }>();
    for (const video of candidates) {
      const row = await knex('videos').where('youtube_id', video.videoId).first();
      if (row) existingByYoutubeId.set(video.videoId, row);
    }

    const prepared: Array<{
      video: VideoInfo;
      status: string;
      updateData: Record<string, any>;
      songTitle?: string;
      songTitles?: string[];
    }> = [];

    for (const video of candidates) {
      if (existingByYoutubeId.has(video.videoId)) continue;

      const { metadata, needsReview } = await parseTitle(video.title);
      const resolved = await resolveParsedMetadata(metadata);
      const forceReview = hasUnresolvedEntity(metadata, resolved);

      const updateData: Record<string, any> = {};
      if (metadata.perf_date) {
        const dateStr = metadata.perf_date;
        updateData.perf_date = new Date(
          `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
        ).toISOString();
      }
      updateData.group_id = resolved.group_id;
      updateData.artist_id = resolved.artist_id;
      updateData.event_id = resolved.event_id;
      updateData.group_name = resolved.group_name;
      updateData.artist_name = resolved.artist_name;
      updateData.event = resolved.event;
      if (metadata.camera_type !== undefined) updateData.camera_type = metadata.camera_type || null;
      updateData.is_own_group_song = metadata.is_own_group_song ?? null;
      updateData.is_own_artist_song = metadata.is_own_artist_song ?? null;

      prepared.push({
        video,
        status: needsReview || forceReview ? 'needs_review' : 'new',
        updateData,
        songTitle: resolved.song_title ?? undefined,
        songTitles: metadata.song_titles,
      });
    }

    // Link already-existing videos to this playlist via the junction table.
    for (const existing of existingByYoutubeId.values()) {
      await knex('video_playlists')
        .insert({ video_id: existing.id, playlist_id: playlistDbId })
        .onConflict(['video_id', 'playlist_id'])
        .ignore();
    }

    await knex.transaction(async (trx: any) => {
      for (const item of prepared) {
        const [createdVideo] = await trx('videos')
          .insert({
            youtube_id: item.video.videoId,
            playlist_id: playlistDbId,
            original_title: item.video.title,
            published_at: item.video.publishedAt,
            status: item.status,
            description: null,
            ...item.updateData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .returning('*');
        await trx('video_playlists').insert({
          video_id: createdVideo.id,
          playlist_id: playlistDbId,
        });
        await syncVideoSongs(createdVideo.id, item.songTitle, item.songTitles, trx);
      }
    });

    return { loaded: prepared.length + existingByYoutubeId.size, linked: existingByYoutubeId.size };
  }

  /**
   * Fetch the next batch of older videos for a playlist, resuming from the stored cursor.
   * Returns { loaded: 0 } once the playlist has been fully pulled (no cursor).
   */
  async loadMoreVideos(id: number, count = PLAYLIST_PAGE_SIZE) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');

    const token = playlist.next_page_token ?? undefined;
    if (!token) {
      return { loaded: 0, total: 0, errors: [] as string[] };
    }

    const { videos, nextPageToken } = await this.fetchPlaylistBatch(
      playlist.youtube_id,
      token,
      count,
    );
    const { loaded } = await this.ingestPlaylistVideos(id, videos);
    await knex('playlists')
      .where('id', id)
      .update({ next_page_token: nextPageToken ?? null });

    return { loaded, total: videos.length, errors: [] as string[] };
  }

  async getPlaylist(id: number) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');
    const total = await knex('video_playlists')
      .where('playlist_id', id)
      .count('* as count')
      .first();
    // Expose whether older videos remain (cursor present) without leaking the raw token.
    const { next_page_token, ...rest } = playlist;
    return {
      ...rest,
      videoCount: Number((total as any)?.count ?? 0),
      hasMore: Boolean(next_page_token),
    };
  }

  async syncPlaylist(id: number) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');

    // Sync only checks the top of the playlist for newly-added videos (cheap); the full
    // archive is pulled on demand via loadMoreVideos.
    const { videos } = await youtubeService.fetchPlaylistItemsPage(playlist.youtube_id);
    const { loaded, linked } = await this.ingestPlaylistVideos(id, videos);

    await playlistRepository.updateLastCheckedAt(id, new Date().toISOString());

    return { loaded, linked, total: videos.length };
  }

  async deletePlaylist(id: number, removeVideos: boolean) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');

    if (removeVideos) {
      // Delete only videos whose sole association is this playlist: not in another playlist,
      // not attached to any channel via the legacy column OR the video_channels junction
      // (ingestVideo writes channel links only into the junction, leaving channel_id null).
      await knex('videos')
        .whereIn('id', function () {
          this.select('video_id').from('video_playlists').where('playlist_id', id);
        })
        .whereNotIn('id', function () {
          this.select('video_id').from('video_playlists').whereNot('playlist_id', id);
        })
        .whereNotIn('id', function () {
          this.select('video_id').from('video_channels');
        })
        .where('channel_id', null)
        .delete();
    }

    // Junction rows cascade-delete when playlist is deleted.
    await playlistRepository.delete(id);
  }
}

export const playlistService = new PlaylistService();
