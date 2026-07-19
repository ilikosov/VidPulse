import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { requestLogService } from '../services/requestLog.service';

// The monitor polls these; recording them would flood the request log with its own traffic.
const IGNORED_PREFIXES = ['/api/requests', '/api/errors'];

/**
 * Records each incoming HTTP request (method/path/status/duration) into the in-memory request log,
 * but only while the monitor is enabled in config — otherwise it's a no-op with negligible overhead.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (!config.monitorEnabled || IGNORED_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    requestLogService.record({
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status_code: res.statusCode,
      duration_ms: Date.now() - start,
      created_at: new Date().toISOString(),
    });
  });
  next();
}
