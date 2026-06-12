import knex from '../db';
import { youtubeService } from './youtube.service';
import { logEvent } from './eventLog.service';
import { parseTitle } from './parser/parser.service';
import { resolveParsedMetadata, hasUnresolvedEntity } from './parser/metadataResolver.service';
import { syncVideoSongs } from './parser/videoSongs.service';
import { playlistRepository } from '../repositories/knex.repositories';
import { AppError } from '../middleware/AppError';

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

    const videos = await youtubeService.fetchPlaylistItems(playlistId);

    // Parse/resolve read the dictionary via the global knex pool. They must run BEFORE the
    // transaction opens — running them while a trx holds SQLite's single write connection
    // deadlocks the pool until acquireConnectionTimeout (~60s) → KnexTimeoutError.
    const existingByYoutubeId = new Map<string, { id: number }>();
    for (const video of videos) {
      const row = await knex('videos').where('youtube_id', video.videoId).first();
      if (row) existingByYoutubeId.set(video.videoId, row);
    }

    const prepared: Array<{
      video: (typeof videos)[number];
      status: string;
      updateData: Record<string, any>;
      songTitle?: string;
      songTitles?: string[];
    }> = [];

    for (const video of videos) {
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
        .insert({ video_id: existing.id, playlist_id: newPlaylistId })
        .onConflict(['video_id', 'playlist_id'])
        .ignore();
    }

    await knex.transaction(async (trx: any) => {
      for (const item of prepared) {
        const [createdVideo] = await trx('videos')
          .insert({
            youtube_id: item.video.videoId,
            playlist_id: newPlaylistId,
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
          playlist_id: newPlaylistId,
        });
        await syncVideoSongs(createdVideo.id, item.songTitle, item.songTitles, trx);
      }
    });

    return newPlaylist;
  }

  async getPlaylist(id: number) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');
    const total = await knex('video_playlists')
      .where('playlist_id', id)
      .count('* as count')
      .first();
    return { ...playlist, videoCount: Number((total as any)?.count ?? 0) };
  }

  async syncPlaylist(id: number) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');

    const videos = await youtubeService.fetchPlaylistItems(playlist.youtube_id);

    // Fetch all existing youtube_ids linked to this playlist (via junction table).
    const linkedIds = (await knex('videos')
      .join('video_playlists', 'videos.id', 'video_playlists.video_id')
      .where('video_playlists.playlist_id', id)
      .pluck('videos.youtube_id')) as string[];
    const linkedSet = new Set(linkedIds);

    // Videos in playlist but not yet linked — may already exist in DB from other context.
    const unlinked = videos.filter((v) => !linkedSet.has(v.videoId));

    const existingByYoutubeId = new Map<string, { id: number }>();
    for (const video of unlinked) {
      const row = await knex('videos').where('youtube_id', video.videoId).first();
      if (row) existingByYoutubeId.set(video.videoId, row);
    }

    // Link already-existing videos to this playlist.
    for (const existing of existingByYoutubeId.values()) {
      await knex('video_playlists')
        .insert({ video_id: existing.id, playlist_id: id })
        .onConflict(['video_id', 'playlist_id'])
        .ignore();
    }

    // Parse new videos (not in DB at all).
    const newVideos = unlinked.filter((v) => !existingByYoutubeId.has(v.videoId));

    const prepared: Array<{
      video: (typeof videos)[number];
      status: string;
      updateData: Record<string, any>;
      songTitle?: string;
      songTitles?: string[];
    }> = [];

    for (const video of newVideos) {
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

    await knex.transaction(async (trx: any) => {
      for (const item of prepared) {
        const [createdVideo] = await trx('videos')
          .insert({
            youtube_id: item.video.videoId,
            playlist_id: id,
            original_title: item.video.title,
            published_at: item.video.publishedAt,
            status: item.status,
            description: null,
            ...item.updateData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .returning('*');
        await trx('video_playlists').insert({ video_id: createdVideo.id, playlist_id: id });
        await syncVideoSongs(createdVideo.id, item.songTitle, item.songTitles, trx);
      }
    });

    await playlistRepository.updateLastCheckedAt(id, new Date().toISOString());

    return {
      loaded: prepared.length + existingByYoutubeId.size,
      linked: existingByYoutubeId.size,
      total: videos.length,
    };
  }

  async deletePlaylist(id: number, removeVideos: boolean) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');

    if (removeVideos) {
      // Delete only videos whose sole playlist association is this one.
      await knex('videos')
        .whereIn('id', function () {
          this.select('video_id').from('video_playlists').where('playlist_id', id);
        })
        .whereNotIn('id', function () {
          this.select('video_id').from('video_playlists').whereNot('playlist_id', id);
        })
        .where('channel_id', null)
        .delete();
    }

    // Junction rows cascade-delete when playlist is deleted.
    await playlistRepository.delete(id);
  }
}

export const playlistService = new PlaylistService();
