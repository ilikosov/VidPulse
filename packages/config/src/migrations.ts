export type RawConfig = Record<string, unknown> & { version?: number };

export interface ConfigMigration {
  /** The version this step produces (it upgrades a file from version `to - 1` to `to`). */
  to: number;
  migrate(raw: RawConfig): RawConfig;
}

/**
 * Ordered config-file migrations, mirroring the knex migration idea: each step upgrades the file by
 * one version. Add a step here AND bump CURRENT_CONFIG_VERSION whenever the config schema changes in
 * a backward-incompatible way; `npm run config:migrate` then upgrades an existing file in place.
 */
export const migrations: ConfigMigration[] = [];

/** The config-file version this build understands. */
export const CURRENT_CONFIG_VERSION = 1;

/**
 * Apply every migration needed to bring `raw` from its own version up to CURRENT_CONFIG_VERSION.
 * Returns the upgraded object plus the from/to versions (for reporting).
 */
export function migrateRawConfig(raw: RawConfig): { config: RawConfig; from: number; to: number } {
  const from = typeof raw.version === 'number' ? raw.version : 0;
  let current: RawConfig = raw;
  for (const step of [...migrations].filter((m) => m.to > from).sort((a, b) => a.to - b.to)) {
    current = { ...step.migrate(current), version: step.to };
  }
  current = { ...current, version: CURRENT_CONFIG_VERSION };
  return { config: current, from, to: CURRENT_CONFIG_VERSION };
}
