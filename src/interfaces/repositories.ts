export interface ChannelEntity { id: number; youtube_id: string; last_checked_at?: string | null }
export interface PlaylistEntity { id: number; youtube_id: string; last_checked_at?: string | null }

export interface IChannelRepository {
  getAll(): Promise<ChannelEntity[]>;
  updateLastCheckedAt(id: number, isoDate: string): Promise<void>;
}

export interface IPlaylistRepository {
  getAll(): Promise<PlaylistEntity[]>;
  updateLastCheckedAt(id: number, isoDate: string): Promise<void>;
}

export interface VideoInsertData { [key: string]: unknown; youtube_id: string; }

export interface IVideoRepository {
  findByYoutubeId(youtubeId: string): Promise<any | null>;
  findYoutubeIdsByPlaylistId(playlistId: number): Promise<Set<string>>;
  insert(data: VideoInsertData): Promise<number>;
}
