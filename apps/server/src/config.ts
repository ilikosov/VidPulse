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

  /** Default pagination page size used across list endpoints/pages. */
  pageSize: num(process.env.PAGE_SIZE, 20),

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? null,
    logApiCalls: bool(process.env.LOG_YOUTUBE_API_CALLS, false),
    proxy: process.env.YOUTUBE_API_PROXY ?? null,
    proxyUser: process.env.YOUTUBE_API_PROXY_USER ?? null,
    proxyPass: process.env.YOUTUBE_API_PROXY_PASS ?? null,
    connectivityTimeoutMs: num(process.env.YOUTUBE_API_CONNECTIVITY_TIMEOUT, 5000),
    requestTimeoutMs: num(process.env.YOUTUBE_API_REQUEST_TIMEOUT, 10000),
  },

  sync: {
    cronTime: process.env.SYNC_CRON_TIME ?? '0 3 * * *',
  },

  kpopDictionary: {
    /** Opt-in: the scheduled refresh only runs when explicitly enabled. */
    enabled: bool(process.env.KPOP_DICT_REFRESH_ENABLED, false),
    /** Cron schedule for the refresh (default: weekly, Monday 04:00). */
    cronTime: process.env.KPOP_DICT_CRON_TIME ?? '0 4 * * 1',
    /** Descriptive User-Agent required by Wikidata's access policy. */
    userAgent:
      process.env.KPOP_SOURCES_USER_AGENT ??
      'VidPulse-KpopDB/1.0 (+https://github.com/ilikosov/vidpulse)',
    /** Optional cap on groups fetched per refresh. */
    limit: process.env.KPOP_DICT_LIMIT
      ? num(process.env.KPOP_DICT_LIMIT, 0) || undefined
      : undefined,
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
    /**
     * Command-line template for the "file command" action. Uses {{entity.param}} syntax
     * with an optional {{each video}}…{{/each}} loop. See services/template/template.engine.ts.
     */
    shellCommand: process.env.SHELL_COMMAND_VIDEO ?? null,
    /**
     * New-name template for the rename action. Defines ONLY the destination filename
     * (without extension — the source extension is preserved); the `mv` command is built
     * automatically against the video's linked file on disk. Uses {{video.param}} tokens.
     */
    renameTemplate: process.env.RENAME_TEMPLATE_VIDEO ?? null,
  },
};

/** Call once at startup (in index.ts) to fail fast when required vars are missing. */
export function validateConfig(): void {
  if (!config.youtube.apiKey) {
    throw new Error('Missing required environment variable: YOUTUBE_API_KEY');
  }
}
