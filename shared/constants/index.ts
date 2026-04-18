// Queue names
export const QUEUE_NAMES = {
  SYNC: 'video-sync',
  ENRICHMENT: 'video-enrichment',
  CLASSIFICATION: 'video-classification',
  BACKFILL: 'channel-backfill',
} as const;

// Job types
export const JOB_TYPES = {
  SYNC_CHANNEL: 'sync_channel',
  ENRICH_VIDEOS: 'enrich_videos',
  BACKFILL_CHANNEL: 'backfill_channel',
  RECLASSIFY_VIDEOS: 'reclassify_videos',
} as const;

// Classification types
export const CLASSIFICATION_TYPES = [
  'fan_cam',
  'official_mv',
  'live_performance',
  'interview',
  'behind_the_scenes',
  'other',
] as const;

// YouTube API constants
export const YOUTUBE_API = {
  BASE_URL: 'https://www.googleapis.com/youtube/v3',
  MAX_RESULTS: 50,
  PART: 'snippet,contentDetails,statistics',
} as const;

// LLM constants
export const LLM = {
  DEFAULT_MODEL: 'gpt-4-turbo-preview',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.1,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  LLM_RESULT: 60 * 60 * 24 * 7, // 7 days
  YOUTUBE_VIDEO: 60 * 60, // 1 hour
  CHANNEL_SYNC: 60 * 5, // 5 minutes
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  RATE_LIMITED: 'Rate limit exceeded',
  INVALID_INPUT: 'Invalid input data',
  INTERNAL_ERROR: 'Internal server error',
} as const;