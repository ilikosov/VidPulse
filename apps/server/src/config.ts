/**
 * Central runtime configuration.
 * All process.env reads (outside tests and knexfile) go here.
 * Call validateConfig() once at startup to fail fast on bad values.
 */

function bool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined) return fallback;
  return val.toLowerCase() === 'true';
}

function num(val: string | undefined, fallback: number): number {
  if (val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3000),

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? null,
    logApiCalls: bool(process.env.LOG_YOUTUBE_API_CALLS, false),
    proxy: process.env.YOUTUBE_API_PROXY ?? null,
    proxyUser: process.env.YOUTUBE_API_PROXY_USER ?? null,
    proxyPass: process.env.YOUTUBE_API_PROXY_PASS ?? null,
    connectivityTimeoutMs: num(process.env.YOUTUBE_API_CONNECTIVITY_TIMEOUT, 5000),
  },

  sync: {
    cronTime: process.env.SYNC_CRON_TIME ?? '0 3 * * *',
  },

  ai: {
    endpoint: process.env.LM_STUDIO_API_URL ?? process.env.LM_STUDIO_URL ?? null,
    model: process.env.LM_STUDIO_MODEL ?? null,
    timeoutMs: num(process.env.LM_STUDIO_TIMEOUT, 30000),
    apiKey: process.env.LM_STUDIO_API_KEY ?? null,
  },

  /** Read dynamically so tests can set process.env after module load. */
  get dangerousActionsEnabled(): boolean {
    return bool(process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED, false);
  },

  maxVideoListItems: num(process.env.MAX_VIDEO_LIST_ITEMS, 100),

  hideFlaggedVideos: bool(process.env.HIDE_FLAGGED_VIDEOS, false),

  files: {
    /** Directory scanned for new files. */
    inputDir: process.env.FILES_INPUT_DIR ?? null,
    /** Directory files are moved to after renaming. */
    outputDir: process.env.FILES_OUTPUT_DIR ?? null,
    /**
     * Comma-separated list of extensions to include during scan (without dot,
     * case-insensitive). When null/empty, all files are included.
     * Example: "mp4,mkv,avi,mov"
     */
    filter: process.env.FILES_FILTER
      ? process.env.FILES_FILTER.split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
      : null,
  },
};

/** Call once at startup (in index.ts) to fail fast when required vars are missing. */
export function validateConfig(): void {
  if (!config.youtube.apiKey) {
    throw new Error('Missing required environment variable: YOUTUBE_API_KEY');
  }
}
