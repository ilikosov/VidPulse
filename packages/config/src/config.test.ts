import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { buildConfig, deepMerge, ensureConfigFile } from './load';
import { migrateRawConfig, migrations, CURRENT_CONFIG_VERSION } from './migrations';

const baseRaw = {
  version: CURRENT_CONFIG_VERSION,
  default: { database: { path: 'db/dev.sqlite3' }, port: 3000 },
  environments: {
    test: { database: { path: 'db/test.sqlite3' }, youtube: { apiKey: 'test-key' } },
  },
};

describe('deepMerge', () => {
  it('merges nested objects; arrays and scalars replace', () => {
    expect(deepMerge({ a: { x: 1, y: 2 }, b: [1] }, { a: { y: 9 }, b: [2] })).toEqual({
      a: { x: 1, y: 9 },
      b: [2],
    });
  });
});

describe('buildConfig', () => {
  it('merges default + environment and applies schema defaults', () => {
    const cfg = buildConfig(baseRaw, 'test');
    expect(cfg.database.path).toBe('db/test.sqlite3');
    expect(cfg.youtube.apiKey).toBe('test-key');
    expect(cfg.port).toBe(3000);
    expect(cfg.parser.strategy).toBe('pipeline'); // schema default
    expect(cfg.files.filter).toBeNull();
    expect(cfg.dangerousActionsEnabled).toBe(false);
  });

  it('resolves database.path against baseDir when provided', () => {
    expect(buildConfig(baseRaw, 'development', '/repo').database.path).toBe('/repo/db/dev.sqlite3');
  });

  it('normalizes parser.strategy (trim + lowercase)', () => {
    const raw = {
      ...baseRaw,
      default: { ...baseRaw.default, parser: { strategy: '  Pipeline ' } },
    };
    expect(buildConfig(raw, 'development').parser.strategy).toBe('pipeline');
  });

  it('throws a clear error on an invalid value type', () => {
    const bad = { ...baseRaw, default: { ...baseRaw.default, port: 'nope' } };
    expect(() => buildConfig(bad, 'development')).toThrow(/Invalid VidPulse configuration/);
  });

  it('fails fast (with a config:migrate hint) when the file version is outdated', () => {
    expect(() => buildConfig({ ...baseRaw, version: 0 }, 'development')).toThrow(
      /outdated[\s\S]*config:migrate/,
    );
  });

  it('rejects a file newer than the supported version', () => {
    expect(() =>
      buildConfig({ ...baseRaw, version: CURRENT_CONFIG_VERSION + 1 }, 'development'),
    ).toThrow(/newer than/);
  });
});

describe('migrateRawConfig', () => {
  afterEach(() => {
    migrations.length = 0;
  });

  it('stamps the current version when nothing to apply', () => {
    const { from, to, config } = migrateRawConfig({ version: CURRENT_CONFIG_VERSION, default: {} });
    expect(from).toBe(CURRENT_CONFIG_VERSION);
    expect(to).toBe(CURRENT_CONFIG_VERSION);
    expect(config.version).toBe(CURRENT_CONFIG_VERSION);
  });

  it('applies migration steps above the file version', () => {
    migrations.push({
      to: CURRENT_CONFIG_VERSION,
      migrate: (raw) => ({ ...raw, migrated: true }),
    });
    const { from, to, config } = migrateRawConfig({ version: 0, default: {} });
    expect(from).toBe(0);
    expect(to).toBe(CURRENT_CONFIG_VERSION);
    expect((config as Record<string, unknown>).migrated).toBe(true);
    expect(config.version).toBe(CURRENT_CONFIG_VERSION);
  });
});

describe('ensureConfigFile', () => {
  let dir: string;
  let file: string;
  const original = process.env.VIDPULSE_CONFIG_PATH;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
    file = path.join(dir, 'vidpulse.config.yaml');
    process.env.VIDPULSE_CONFIG_PATH = file;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.VIDPULSE_CONFIG_PATH;
    else process.env.VIDPULSE_CONFIG_PATH = original;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the file with default parameters when missing', () => {
    expect(fs.existsSync(file)).toBe(false);
    ensureConfigFile();
    const raw = YAML.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.version).toBe(CURRENT_CONFIG_VERSION);
    expect(raw.default.parser.strategy).toBe('pipeline');
    expect(raw.environments.test.youtube.apiKey).toBe('test-key');
  });

  it('migrates an older file up to the current version, preserving user values, and backs it up', () => {
    fs.writeFileSync(
      file,
      YAML.stringify({ version: 0, default: { port: 4000 }, environments: {} }),
    );
    ensureConfigFile();
    const raw = YAML.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.version).toBe(CURRENT_CONFIG_VERSION);
    expect(raw.default.port).toBe(4000); // user value kept
    expect(raw.default.parser.strategy).toBe('pipeline'); // newly-added default filled in
    expect(fs.existsSync(`${file}.bak`)).toBe(true);
  });

  it('leaves an up-to-date file untouched (no backup)', () => {
    ensureConfigFile();
    ensureConfigFile();
    expect(fs.existsSync(`${file}.bak`)).toBe(false);
  });
});
