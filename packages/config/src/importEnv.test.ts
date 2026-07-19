import { describe, it, expect } from 'vitest';
import { parseEnvContent, applyEnvToRaw } from './importEnv';
import { buildConfig } from './load';
import { CURRENT_CONFIG_VERSION } from './migrations';

describe('parseEnvContent', () => {
  it('parses KEY=VALUE, skips comments/blanks, strips surrounding quotes', () => {
    const env = parseEnvContent(
      [
        '# comment',
        '',
        'PORT=4000',
        'YOUTUBE_API_KEY="secret"',
        "SYNC_CRON_TIME='0 5 * * *'",
        'BROKEN',
      ].join('\n'),
    );
    expect(env).toEqual({
      PORT: '4000',
      YOUTUBE_API_KEY: 'secret',
      SYNC_CRON_TIME: '0 5 * * *',
    });
  });
});

describe('applyEnvToRaw', () => {
  const baseRaw = {
    version: CURRENT_CONFIG_VERSION,
    default: { database: { path: 'db/dev.sqlite3' } },
    environments: { test: { database: { path: 'db/test.sqlite3' } } },
  };

  it('coerces types and places values at the right config paths', () => {
    const env = {
      PORT: '4000',
      YOUTUBE_API_KEY: 'real-key',
      LOG_YOUTUBE_API_CALLS: 'true',
      HIDE_FLAGGED_VIDEOS: 'true',
      FILES_FILTER: 'MP4, mkv ,avi',
      MAX_VIDEO_LIST_ITEMS: '250',
      DATABASE_PATH: '/data/prod.sqlite3',
      TEST_DATABASE_PATH: '/data/test.sqlite3',
      MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED: 'true',
    };
    const { config, applied } = applyEnvToRaw(env, baseRaw);

    expect(config.default!.port).toBe(4000);
    expect((config.default!.youtube as Record<string, unknown>).apiKey).toBe('real-key');
    expect((config.default!.youtube as Record<string, unknown>).logApiCalls).toBe(true);
    expect(config.default!.hideFlaggedVideos).toBe(true);
    expect(config.default!.dangerousActionsEnabled).toBe(true);
    expect((config.default!.files as Record<string, unknown>).filter).toEqual([
      'mp4',
      'mkv',
      'avi',
    ]);
    expect(config.default!.maxVideoListItems).toBe(250);
    expect((config.default!.database as Record<string, unknown>).path).toBe('/data/prod.sqlite3');
    expect(config.environments!.test.database).toEqual({ path: '/data/test.sqlite3' });
    expect(applied).toContain('default.port');
    expect(applied).toContain('environments.test.database.path');

    // does not mutate the input
    expect((baseRaw.default as Record<string, unknown>).port).toBeUndefined();
  });

  it('LM_STUDIO_API_URL wins over the legacy LM_STUDIO_URL', () => {
    const { config } = applyEnvToRaw(
      { LM_STUDIO_URL: 'http://old', LM_STUDIO_API_URL: 'http://new' },
      baseRaw,
    );
    expect((config.default!.ai as Record<string, unknown>).endpoint).toBe('http://new');
  });

  it('produces a config the schema accepts', () => {
    const { config } = applyEnvToRaw({ PORT: '4000', YOUTUBE_API_KEY: 'k' }, baseRaw);
    const built = buildConfig(config, 'development');
    expect(built.port).toBe(4000);
    expect(built.youtube.apiKey).toBe('k');
  });
});
