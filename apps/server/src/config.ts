/**
 * Central runtime configuration. Values come from the typed, schema-validated vidpulse.config.yaml
 * (see @vidpulse/config). The shape matches the historical config object 1:1, so callers keep using
 * `config.files.renameTemplate`, `config.youtube.apiKey`, etc.
 */
export { config } from '@vidpulse/config';
import { config } from '@vidpulse/config';

/** Call once at startup (in index.ts) to fail fast when required values are missing. */
export function validateConfig(): void {
  if (!config.youtube.apiKey) {
    throw new Error(
      'Missing required configuration: youtube.apiKey (set it in vidpulse.config.yaml)',
    );
  }
}
