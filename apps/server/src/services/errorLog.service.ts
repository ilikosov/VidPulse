import { errorLogRepository } from '@vidpulse/db';
import { logger } from '../lib/logger';

/** Context captured alongside a persisted error. */
export interface ErrorLogContext {
  method?: string;
  path?: string;
  statusCode?: number;
  extra?: Record<string, unknown>;
}

/**
 * Persist an error (stack trace + request context) to the error_log table. Never throws — a failure
 * to record must not mask the original error or break the request, so it's swallowed to the logger.
 */
export async function logError(err: unknown, context?: ErrorLogContext): Promise<void> {
  try {
    const e = err instanceof Error ? err : undefined;
    await errorLogRepository.insert({
      name: e?.name ?? (typeof err === 'string' ? 'Error' : 'UnknownError'),
      message: e?.message ?? String(err),
      stack: e?.stack ?? null,
      method: context?.method ?? null,
      path: context?.path ?? null,
      status_code: context?.statusCode ?? null,
      context: context?.extra ? JSON.stringify(context.extra) : null,
    });
  } catch (persistError) {
    logger.error({ err: persistError }, 'Failed to persist error to error_log');
  }
}
