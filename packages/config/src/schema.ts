import { z } from 'zod';

const DEFAULT_USER_AGENT = 'VidPulse-KpopDB/1.0 (+https://github.com/ilikosov/vidpulse)';

/**
 * The full VidPulse runtime configuration. The shape mirrors the historical `apps/server/src/config.ts`
 * object 1:1 (so consumers keep using `config.files.renameTemplate` etc.), plus `database.path` which
 * used to live in the DATABASE_PATH env var. zod is the single source of truth for both the TypeScript
 * type (`Config = z.infer<...>`) and runtime validation of the config file.
 */
export const configSchema = z.object({
  port: z.number().int().positive().default(3000),

  database: z.object({
    path: z.string(),
  }),

  youtube: z
    .object({
      apiKey: z.string().nullable().default(null),
      logApiCalls: z.boolean().default(false),
      proxy: z.string().nullable().default(null),
      proxyUser: z.string().nullable().default(null),
      proxyPass: z.string().nullable().default(null),
      connectivityTimeoutMs: z.number().default(5000),
      requestTimeoutMs: z.number().default(10000),
    })
    .default({}),

  sync: z
    .object({
      cronTime: z.string().default('0 3 * * *'),
    })
    .default({}),

  kpopDictionary: z
    .object({
      enabled: z.boolean().default(false),
      cronTime: z.string().default('0 4 * * 1'),
      userAgent: z.string().default(DEFAULT_USER_AGENT),
      limit: z.number().optional(),
      timeoutMs: z.number().default(60000),
    })
    .default({}),

  musicBrainz: z
    .object({
      enabled: z.boolean().default(false),
      userAgent: z.string().default(DEFAULT_USER_AGENT),
      rateLimitMs: z.number().default(1000),
      limit: z.number().default(50),
      maxRecordings: z.number().default(1000),
    })
    .default({}),

  ai: z
    .object({
      endpoint: z.string().nullable().default(null),
      model: z.string().nullable().default(null),
      timeoutMs: z.number().default(30000),
      apiKey: z.string().nullable().default(null),
    })
    .default({}),

  parser: z
    .object({
      // Normalized like the old env getter so an unknown value fails loudly downstream.
      strategy: z
        .string()
        .default('pipeline')
        .transform((s) => s.trim().toLowerCase()),
    })
    .default({}),

  dangerousActionsEnabled: z.boolean().default(false),

  maxVideoListItems: z.number().default(100),

  hideFlaggedVideos: z.boolean().default(false),

  files: z
    .object({
      inputDir: z.string().nullable().default(null),
      outputDir: z.string().nullable().default(null),
      /** Extensions to include during scan (without dot). null/empty → all files. */
      filter: z.array(z.string()).nullable().default(null),
      shellCommand: z.string().nullable().default(null),
      shellCommandExcludeExisting: z.boolean().default(false),
      renameTemplate: z.string().nullable().default(null),
    })
    .default({}),
});

export type Config = z.infer<typeof configSchema>;
