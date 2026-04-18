import { z } from 'zod';

// Video metadata from YouTube API
export const YouTubeVideoSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  publishedAt: z.string().datetime(),
  duration: z.string().optional(),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  thumbnails: z.record(z.object({
    url: z.string(),
    width: z.number(),
    height: z.number(),
  })).optional(),
});

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

// Classification result
export const ClassificationResultSchema = z.object({
  type: z.enum(['fan_cam', 'official_mv', 'live_performance', 'interview', 'behind_the_scenes', 'other']),
  artist: z.string().optional(),
  group: z.string().optional(),
  song: z.string().optional(),
  event: z.string().optional(),
  location: z.string().optional(),
  date: z.string().date().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// Video entity in database
export const VideoSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  publishedAt: z.date(),
  metadata: z.record(z.any()),
  extraction: ClassificationResultSchema.nullable(),
  classificationVersion: z.number().int().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Video = z.infer<typeof VideoSchema>;

// Channel entity
export const ChannelSchema = z.object({
  id: z.string(),
  title: z.string(),
  uploadsPlaylistId: z.string(),
  lastSyncedAt: z.date().nullable(),
  backfillCursor: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Channel = z.infer<typeof ChannelSchema>;

// Queue job types
export enum JobType {
  SYNC_CHANNEL = 'sync_channel',
  ENRICH_VIDEOS = 'enrich_videos',
  BACKFILL_CHANNEL = 'backfill_channel',
  RECLASSIFY_VIDEOS = 'reclassify_videos',
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}