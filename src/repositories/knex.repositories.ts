import knex from '../db';
import type { IChannelRepository, IPlaylistRepository, IVideoRepository, ChannelEntity, PlaylistEntity, VideoInsertData } from '../interfaces/repositories';

export class KnexChannelRepository implements IChannelRepository {
  async getAll(): Promise<ChannelEntity[]> { return knex('channels').select('*'); }
  async updateLastCheckedAt(id: number, isoDate: string): Promise<void> { await knex('channels').where('id', id).update({ last_checked_at: isoDate }); }
}

export class KnexPlaylistRepository implements IPlaylistRepository {
  async getAll(): Promise<PlaylistEntity[]> { return knex('playlists').select('*'); }
  async updateLastCheckedAt(id: number, isoDate: string): Promise<void> { await knex('playlists').where('id', id).update({ last_checked_at: isoDate }); }
}

export class KnexVideoRepository implements IVideoRepository {
  async findByYoutubeId(youtubeId: string): Promise<any | null> { return (await knex('videos').where('youtube_id', youtubeId).first()) ?? null; }
  async findYoutubeIdsByPlaylistId(playlistId: number): Promise<Set<string>> {
    const rows = await knex('videos').where('playlist_id', playlistId).select('youtube_id');
    return new Set(rows.map((r) => r.youtube_id));
  }
  async insert(data: VideoInsertData): Promise<number> {
    const result = await knex('videos').insert(data).returning('id');
    const inserted = Array.isArray(result) ? result[0] : result;
    return typeof inserted === 'object' ? inserted.id : inserted;
  }
}
