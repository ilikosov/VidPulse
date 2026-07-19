import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { ensureConfigFile, parseRawConfigFile } from '../load';
import { parseEnvContent, applyEnvToRaw } from '../importEnv';

/**
 * One-time migration helper: import values from a legacy `.env` file into vidpulse.config.yaml.
 * Usage: `npm run config:import-env -- [path/to/.env]` (defaults to ./.env). Writes a .bak backup.
 */
function main(): void {
  const envPath = path.resolve(process.argv[2] ?? '.env');
  if (!fs.existsSync(envPath)) {
    console.error(
      `No .env file found at ${envPath}. Pass a path: config:import-env -- path/to/.env`,
    );
    process.exit(1);
  }

  const envMap = parseEnvContent(fs.readFileSync(envPath, 'utf8'));
  const configPath = ensureConfigFile(); // create/migrate the config file first
  const raw = parseRawConfigFile(configPath);
  const { config: updated, applied } = applyEnvToRaw(envMap, raw);

  if (applied.length === 0) {
    console.log(`No recognized variables found in ${envPath}; ${configPath} left unchanged.`);
    return;
  }

  fs.writeFileSync(`${configPath}.bak`, YAML.stringify(raw));
  fs.writeFileSync(configPath, YAML.stringify(updated));
  console.log(
    `Imported ${applied.length} value(s) from ${envPath} into ${configPath} ` +
      `(backup: ${configPath}.bak):`,
  );
  console.log(`  ${applied.join('\n  ')}`);
}

main();
