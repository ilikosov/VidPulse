import type { RawConfigFile } from './load';

type Coerce = 'string' | 'number' | 'boolean' | 'csv';

interface EnvMapping {
  env: string;
  /** Dotted path within the raw config file, e.g. `default.youtube.apiKey`. */
  path: string;
  coerce: Coerce;
}

/**
 * Maps the legacy .env variables onto their place in the new config file. Mirrors the historical
 * apps/server/src/config.ts reads. DATABASE_PATH / TEST_DATABASE_PATH land in the right sections;
 * everything else goes under `default`. LM_STUDIO_URL (legacy) is listed before LM_STUDIO_API_URL so
 * the newer variable wins when both are present, matching `LM_STUDIO_API_URL ?? LM_STUDIO_URL`.
 */
export const ENV_MAPPINGS: EnvMapping[] = [
  { env: 'PORT', path: 'default.port', coerce: 'number' },
  { env: 'DATABASE_PATH', path: 'default.database.path', coerce: 'string' },
  { env: 'TEST_DATABASE_PATH', path: 'environments.test.database.path', coerce: 'string' },
  { env: 'YOUTUBE_API_KEY', path: 'default.youtube.apiKey', coerce: 'string' },
  { env: 'LOG_YOUTUBE_API_CALLS', path: 'default.youtube.logApiCalls', coerce: 'boolean' },
  { env: 'YOUTUBE_API_PROXY', path: 'default.youtube.proxy', coerce: 'string' },
  { env: 'YOUTUBE_API_PROXY_USER', path: 'default.youtube.proxyUser', coerce: 'string' },
  { env: 'YOUTUBE_API_PROXY_PASS', path: 'default.youtube.proxyPass', coerce: 'string' },
  {
    env: 'YOUTUBE_API_CONNECTIVITY_TIMEOUT',
    path: 'default.youtube.connectivityTimeoutMs',
    coerce: 'number',
  },
  {
    env: 'YOUTUBE_API_REQUEST_TIMEOUT',
    path: 'default.youtube.requestTimeoutMs',
    coerce: 'number',
  },
  { env: 'SYNC_CRON_TIME', path: 'default.sync.cronTime', coerce: 'string' },
  { env: 'KPOP_DICT_REFRESH_ENABLED', path: 'default.kpopDictionary.enabled', coerce: 'boolean' },
  { env: 'KPOP_DICT_CRON_TIME', path: 'default.kpopDictionary.cronTime', coerce: 'string' },
  { env: 'KPOP_SOURCES_USER_AGENT', path: 'default.kpopDictionary.userAgent', coerce: 'string' },
  { env: 'KPOP_DICT_LIMIT', path: 'default.kpopDictionary.limit', coerce: 'number' },
  { env: 'KPOP_DICT_TIMEOUT_MS', path: 'default.kpopDictionary.timeoutMs', coerce: 'number' },
  { env: 'MUSICBRAINZ_REFRESH_ENABLED', path: 'default.musicBrainz.enabled', coerce: 'boolean' },
  { env: 'MUSICBRAINZ_USER_AGENT', path: 'default.musicBrainz.userAgent', coerce: 'string' },
  { env: 'MUSICBRAINZ_RATE_LIMIT_MS', path: 'default.musicBrainz.rateLimitMs', coerce: 'number' },
  { env: 'MUSICBRAINZ_LIMIT', path: 'default.musicBrainz.limit', coerce: 'number' },
  {
    env: 'MUSICBRAINZ_MAX_RECORDINGS',
    path: 'default.musicBrainz.maxRecordings',
    coerce: 'number',
  },
  { env: 'LM_STUDIO_URL', path: 'default.ai.endpoint', coerce: 'string' },
  { env: 'LM_STUDIO_API_URL', path: 'default.ai.endpoint', coerce: 'string' },
  { env: 'LM_STUDIO_MODEL', path: 'default.ai.model', coerce: 'string' },
  { env: 'LM_STUDIO_TIMEOUT', path: 'default.ai.timeoutMs', coerce: 'number' },
  { env: 'LM_STUDIO_API_KEY', path: 'default.ai.apiKey', coerce: 'string' },
  { env: 'PARSER_STRATEGY', path: 'default.parser.strategy', coerce: 'string' },
  {
    env: 'MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED',
    path: 'default.dangerousActionsEnabled',
    coerce: 'boolean',
  },
  { env: 'MAX_VIDEO_LIST_ITEMS', path: 'default.maxVideoListItems', coerce: 'number' },
  { env: 'HIDE_FLAGGED_VIDEOS', path: 'default.hideFlaggedVideos', coerce: 'boolean' },
  { env: 'FILES_INPUT_DIR', path: 'default.files.inputDir', coerce: 'string' },
  { env: 'FILES_OUTPUT_DIR', path: 'default.files.outputDir', coerce: 'string' },
  { env: 'FILES_FILTER', path: 'default.files.filter', coerce: 'csv' },
  { env: 'SHELL_COMMAND_VIDEO', path: 'default.files.shellCommand', coerce: 'string' },
  {
    env: 'SHELL_COMMAND_EXCLUDE_EXISTING_FILES',
    path: 'default.files.shellCommandExcludeExisting',
    coerce: 'boolean',
  },
  { env: 'RENAME_TEMPLATE_VIDEO', path: 'default.files.renameTemplate', coerce: 'string' },
];

/** Parse a .env file's contents into a flat key→value map (comments/blank lines skipped). */
export function parseEnvContent(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function coerce(value: string, kind: Coerce): unknown | undefined {
  switch (kind) {
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined; // skip garbage numbers
    }
    case 'csv':
      return value
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    default:
      return value;
  }
}

function setPath(target: Record<string, unknown>, dottedPath: string, value: unknown): void {
  const keys = dottedPath.split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

/**
 * Apply the mapped .env values onto a raw config object (returns a new object; the input isn't
 * mutated). Returns the updated raw config and the list of config paths that were set.
 */
export function applyEnvToRaw(
  envMap: Record<string, string>,
  raw: RawConfigFile,
): { config: RawConfigFile; applied: string[] } {
  const clone = JSON.parse(JSON.stringify(raw ?? {})) as Record<string, unknown>;
  const applied: string[] = [];
  for (const mapping of ENV_MAPPINGS) {
    if (!(mapping.env in envMap)) continue;
    const value = coerce(envMap[mapping.env], mapping.coerce);
    if (value === undefined) continue;
    setPath(clone, mapping.path, value);
    applied.push(mapping.path);
  }
  return { config: clone as RawConfigFile, applied };
}
