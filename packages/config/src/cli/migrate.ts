import { ensureConfigFile } from '../load';

/**
 * Bring the config file to the current version: create it with defaults if missing, or migrate it
 * up (writing a `.bak` backup) if it's older. This is normally done automatically at app startup —
 * the CLI just makes it an explicit step.
 */
ensureConfigFile();
