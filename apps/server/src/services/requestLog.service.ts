import type { RequestLogEntry } from '@vidpulse/shared';

/**
 * In-memory ring buffer of the most recent incoming HTTP requests — the "request log" surfaced in
 * the monitor overlay. Deliberately not persisted: it's a live debugging tail, bounded in size and
 * cleared on restart, so it never touches the DB on the hot request path.
 */
class RequestLogService {
  private readonly capacity = 500;
  private buffer: RequestLogEntry[] = [];
  private nextId = 1;

  record(entry: Omit<RequestLogEntry, 'id'>): void {
    this.buffer.push({ id: this.nextId++, ...entry });
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }
  }

  /** Most recent first. */
  getAll(): RequestLogEntry[] {
    return [...this.buffer].reverse();
  }

  clear(): void {
    this.buffer = [];
  }
}

export const requestLogService = new RequestLogService();
