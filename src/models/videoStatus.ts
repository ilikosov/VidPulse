export const VALID_STATUSES = [
  'new',
  'needs_review',
  'downloaded',
  'renamed',
  'thumbnails_generated',
  'ready_for_upload',
  'completed',
  'error',
  'ignored',
] as const;

export type VideoStatus = (typeof VALID_STATUSES)[number];

export function isValidStatus(value: unknown): value is VideoStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as VideoStatus);
}
