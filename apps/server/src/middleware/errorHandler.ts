import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { AppError } from './AppError';
import { logError } from '../services/errorLog.service';

export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json({ error: { message: `Route not found: ${req.method} ${req.path}`, code: 'NOT_FOUND' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // An Error JSON.stringifies to "{}" (no enumerable own props), so log its stack/message.
  const detail = err instanceof Error ? (err.stack ?? err.message) : err;

  if (err instanceof AppError) {
    // Only server faults are journaled; expected client errors (4xx) are not "errors" worth a stack.
    if (err.statusCode >= 500) {
      logger.error({ err: detail, path: req.path }, err.message);
      void logError(err, { method: req.method, path: req.path, statusCode: err.statusCode });
    }
    res.status(err.statusCode).json({
      error: { message: err.message, ...(err.code ? { code: err.code } : {}) },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error({ err: detail, path: req.path }, message);
  void logError(err, { method: req.method, path: req.path, statusCode: 500 });
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
}
