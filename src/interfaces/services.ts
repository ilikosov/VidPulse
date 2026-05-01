import type { ParsedMetadata } from '../services/parser/parser.types';
import type { VideoDetails, VideoInfo } from '../models/youtube.types';

export interface IYouTubeService {
  fetchChannelVideos(channelId: string, publishedAfter: string): Promise<VideoInfo[]>;
  fetchPlaylistItems(playlistId: string): Promise<VideoInfo[]>;
  getVideoDetails(videoId: string): Promise<VideoDetails>;
}

export interface IEventLogger {
  logEvent(eventType: string, description?: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface ITagService {
  assignAutoTags(videoId: number, durationSeconds?: number, privacyStatus?: string): Promise<void>;
}

export interface IParser {
  parseTitle(title: string, publishedAt?: string, tags?: string[]): Promise<{ metadata: Partial<ParsedMetadata>; needsReview: boolean }>;
}

export interface IChannelSyncService { sync(): Promise<void>; }
export interface IPlaylistSyncService { sync(): Promise<void>; }
export interface ISyncService { syncAll(): Promise<void>; runScheduler(): void; }
