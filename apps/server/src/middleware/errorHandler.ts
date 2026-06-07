import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { AppError } from './AppError';

export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json({ error: { message: `Route not found: ${req.method} ${req.path}`, code: 'NOT_FOUND' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      error: { message: err.message, ...(err.code ? { code: err.code } : {}) },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error({ err, path: req.path }, message);
  res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
}
