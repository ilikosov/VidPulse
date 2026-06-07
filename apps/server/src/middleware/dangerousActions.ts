import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export function dangerousActionsEnabled(): boolean {
  return config.dangerousActionsEnabled;
}

export function requireDangerousActionsEnabled(_req: Request, res: Response, next: NextFunction) {
  if (!dangerousActionsEnabled()) {
    return res
      .status(403)
      .json({ error: { message: 'Dangerous media library actions are disabled' } });
  }
  return next();
}
