import { NextFunction, Request, Response } from 'express';

export function dangerousActionsEnabled(): boolean {
  return process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED === 'true';
}

export function requireDangerousActionsEnabled(_req: Request, res: Response, next: NextFunction) {
  if (!dangerousActionsEnabled()) {
    return res.status(403).json({ error: 'Dangerous media library actions are disabled' });
  }
  return next();
}
