import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { configSchema, type Config } from './schema';
import { CURRENT_CONFIG_VERSION, migrateRawConfig, type RawConfig } from './migrations';

export const CONFIG_FILENAME = 'vidpulse.config.yaml';

export interface RawConfigFile {
  version?: number;
  default?: Record<string, unknown>;
  environments?: Record<string, Record<string, unknown>>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge `override` onto `base`: nested objects merge; arrays and scalars replace. */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out;
}

export function currentEnv(): string {
  return process.env.NODE_ENV || 'development';
}

/**
 * The default config-file contents (used to create the file when it's missing and to fill in
 * newly-added keys on migration). The `default` section is derived from the zod schema defaults, so
 * adding a field to the schema automatically extends the generated file.
 */
export function defaultRawConfig(): Required<
  Pick<RawConfigFile, 'version' | 'default' | 'environments'>
> {
  const base = configSchema.parse({
    database: { path: 'apps/server/src/db/dev.sqlite3' },
  }) as unknown as Record<string, unknown>;
  return {
    version: CURRENT_CONFIG_VERSION,
    default: base,
    environments: {
      test: {
        database: { path: 'apps/server/src/db/dev.test.sqlite3' },
        youtube: { apiKey: 'test-key' },
      },
      production: {},
    },
  };
}

/** The nearest ancestor dir whose package.json declares `workspaces` (the monorepo root). */
function findWorkspaceRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, 'utf8')).workspaces) return dir;
      } catch {
        /* ignore malformed package.json */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve where the config file is (or should be created): VIDPULSE_CONFIG_PATH if set; else the
 * nearest existing file walking up from cwd; else the monorepo root (so create-if-missing lands in a
 * single, stable place regardless of the process cwd).
 */
export function resolveConfigPath(startDir: string = process.cwd()): string {
  if (process.env.VIDPULSE_CONFIG_PATH) return path.resolve(process.env.VIDPULSE_CONFIG_PATH);
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const root = findWorkspaceRoot(startDir) ?? path.resolve(startDir);
  return path.join(root, CONFIG_FILENAME);
}

export function parseRawConfigFile(filePath: string): RawConfigFile {
  return (YAML.parse(fs.readFileSync(filePath, 'utf8')) ?? {}) as RawConfigFile;
}

/**
 * Ensure the config file exists and is current, then return its path.
 *  - missing  → create it with default parameters;
 *  - outdated → migrate it up to the current version (backup written to `<file>.bak`), also filling
 *               any newly-added default keys from the schema;
 *  - newer    → throw (the app is older than the file);
 * Called at startup (via the loader) so `config:migrate` is usually not needed manually.
 */
export function ensureConfigFile(): string {
  const filePath = resolveConfigPath();

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, YAML.stringify(defaultRawConfig()));
    console.log(`[config] created ${CONFIG_FILENAME} with default parameters at ${filePath}`);
    return filePath;
  }

  const raw = parseRawConfigFile(filePath);
  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version > CURRENT_CONFIG_VERSION) {
    throw new Error(
      `Config file version ${version} is newer than this build supports (${CURRENT_CONFIG_VERSION}). ` +
        `Update the application.`,
    );
  }

  if (version < CURRENT_CONFIG_VERSION) {
    const { config: migrated } = migrateRawConfig(raw as unknown as RawConfig);
    // Fill in any keys added to the schema since this file was written (user values win).
    migrated.default = deepMerge(
      defaultRawConfig().default,
      (migrated.default as Record<string, unknown>) ?? {},
    ) as Record<string, unknown>;
    fs.writeFileSync(`${filePath}.bak`, YAML.stringify(raw));
    fs.writeFileSync(filePath, YAML.stringify(migrated));
    console.log(
      `[config] migrated ${CONFIG_FILENAME} ${version} → ${CURRENT_CONFIG_VERSION} ` +
        `(backup: ${filePath}.bak)`,
    );
  }

  return filePath;
}

/**
 * Build a validated Config for `env` from a parsed raw file. Merges the `default` section with the
 * per-environment overrides and validates against the zod schema. The version guards are a safety
 * net — ensureConfigFile() normally brings the file to the current version first.
 */
export function buildConfig(
  raw: RawConfigFile,
  env: string = currentEnv(),
  baseDir?: string,
): Config {
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version < CURRENT_CONFIG_VERSION) {
    throw new Error(
      `Config file version ${version} is outdated (current ${CURRENT_CONFIG_VERSION}). ` +
        `Run: npm run config:migrate`,
    );
  }
  if (version > CURRENT_CONFIG_VERSION) {
    throw new Error(
      `Config file version ${version} is newer than this build supports (${CURRENT_CONFIG_VERSION}). ` +
        `Update the application.`,
    );
  }
  const merged = deepMerge(raw.default ?? {}, raw.environments?.[env] ?? {});
  let parsed: Config;
  try {
    parsed = configSchema.parse(merged);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Invalid VidPulse configuration for environment "${env}":\n${err.message}`);
    }
    throw err;
  }
  // Resolve the DB path relative to the config file's directory, so it's independent of process cwd.
  if (baseDir) {
    parsed.database.path = path.resolve(baseDir, parsed.database.path);
  }
  return parsed;
}

/** Ensure the file exists/current, then load + validate the config for a specific environment. */
export function loadConfigForEnv(env: string): Config {
  const filePath = ensureConfigFile();
  return buildConfig(parseRawConfigFile(filePath), env, path.dirname(filePath));
}

/** Load + validate the config for the current NODE_ENV. */
export function loadConfig(): Config {
  return loadConfigForEnv(currentEnv());
}
