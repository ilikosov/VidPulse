import type { ParseResult } from '@vidpulse/parser';
import type { VideoDetails, VideoInfo } from '../models/youtube.types';

export interface IYouTubeService {
  fetchChannelVideos(channelId: string, publishedAfter: string): Promise<VideoInfo[]>;
  fetchPlaylistItems(playlistId: string): Promise<VideoInfo[]>;
  getVideoDetails(videoId: string): Promise<VideoDetails>;
}

export interface IEventLogger {
  logEvent(
    eventType: string,
    description?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

export interface ITagService {
  assignAutoTags(videoId: number, durationSeconds?: number, privacyStatus?: string): Promise<void>;
}

/**
 * The pinned parser contract. Any parser implementation (regex+dictionary pipeline, LLM, …) must
 * satisfy this. The selected implementation is resolved by the parser registry from
 * config.parser.strategy (PARSER_STRATEGY). Callers always follow parseTitle with the shared
 * resolveParsedMetadata step, so entity linking to the dictionary is parser-agnostic.
 */
export interface IParser {
  parseTitle(
    title: string,
    publishedAt?: string,
    tags?: string[],
    description?: string,
  ): Promise<ParseResult>;
}

export interface IChannelSyncService {
  sync(): Promise<void>;
}
export interface IPlaylistSyncService {
  sync(): Promise<void>;
}
export interface ISyncService {
  syncAll(): Promise<void>;
  runScheduler(): void;
  stopScheduler(): void;
}
