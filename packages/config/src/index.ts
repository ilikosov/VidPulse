import { loadConfig } from './load';
import type { Config } from './schema';

export type { Config } from './schema';
export { configSchema } from './schema';
export {
  loadConfig,
  loadConfigForEnv,
  buildConfig,
  deepMerge,
  resolveConfigPath,
  ensureConfigFile,
  defaultRawConfig,
  parseRawConfigFile,
  currentEnv,
  CONFIG_FILENAME,
} from './load';
export { CURRENT_CONFIG_VERSION, migrateRawConfig, migrations } from './migrations';
export type { RawConfig, ConfigMigration } from './migrations';

/**
 * The live, validated configuration for the current NODE_ENV, loaded from vidpulse.config.yaml.
 *
 * It's a plain mutable object on purpose: tests can override values (e.g.
 * `config.files.renameTemplate = '…'`) and restore them — mirroring how they used to mutate
 * process.env — and `resetConfig()` reloads from the file.
 */
export const config: Config = loadConfig();

function deepAssign(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      deepAssign(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

/** Deep-merge overrides into the live config (test convenience). */
export function setConfigOverride(overrides: Record<string, unknown>): void {
  deepAssign(config as unknown as Record<string, unknown>, overrides);
}

/** Reload the live config from the file, discarding any overrides (test cleanup). */
export function resetConfig(): void {
  const fresh = loadConfig();
  const target = config as unknown as Record<string, unknown>;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, fresh);
}
