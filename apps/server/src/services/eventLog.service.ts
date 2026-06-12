import { knex } from '@vidpulse/db';
import { logger } from '../lib/logger';

export async function logEvent(
  eventType: string,
  description?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await knex('event_log').insert({
      event_type: eventType,
      description: description ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log event:', error);
  }
}
