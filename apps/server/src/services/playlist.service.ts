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

    await knex.transaction(async (trx: any) => {
      for (const video of videos) {
        const existingVideo = await trx('videos').where('youtube_id', video.videoId).first();
        if (!existingVideo) {
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
          if (metadata.camera_type !== undefined)
            updateData.camera_type = metadata.camera_type || null;
          updateData.is_own_group_song = metadata.is_own_group_song ?? null;
          updateData.is_own_artist_song = metadata.is_own_artist_song ?? null;

          const [createdVideo] = await trx('videos')
            .insert({
              youtube_id: video.videoId,
              playlist_id: newPlaylistId,
              original_title: video.title,
              published_at: video.publishedAt,
              status: needsReview || forceReview ? 'needs_review' : 'new',
              description: null,
              ...updateData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .returning('*');
          await syncVideoSongs(
            createdVideo.id,
            resolved.song_title ?? undefined,
            metadata.song_titles,
            trx,
          );
        }
      }
    });

    return newPlaylist;
  }

  async deletePlaylist(id: number, removeVideos: boolean) {
    const playlist = await playlistRepository.findById(id);
    if (!playlist) throw AppError.notFound('Playlist not found');

    if (removeVideos) {
      await knex('videos').where('playlist_id', id).delete();
    } else {
      await knex('videos').where('playlist_id', id).update({ playlist_id: null });
    }

    await playlistRepository.delete(id);
  }
}

export const playlistService = new PlaylistService();
