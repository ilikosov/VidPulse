import { describe, it, expect, beforeEach } from 'vitest';
import { requestLogService } from './requestLog.service';

const entry = (path: string) => ({
  method: 'GET',
  path,
  status_code: 200,
  duration_ms: 1,
  created_at: '2026-01-01T00:00:00.000Z',
});

describe('requestLogService (in-memory ring buffer)', () => {
  beforeEach(() => requestLogService.clear());

  it('records entries newest-first with incrementing ids', () => {
    requestLogService.record(entry('/a'));
    requestLogService.record(entry('/b'));
    const all = requestLogService.getAll();
    expect(all.map((e) => e.path)).toEqual(['/b', '/a']);
    expect(all[0].id).toBeGreaterThan(all[1].id);
  });

  it('caps at capacity (500), dropping the oldest', () => {
    for (let i = 0; i < 520; i++) requestLogService.record(entry(`/${i}`));
    const all = requestLogService.getAll();
    expect(all).toHaveLength(500);
    expect(all[0].path).toBe('/519'); // newest kept
    expect(all[all.length - 1].path).toBe('/20'); // /0../19 dropped
  });

  it('clear empties the buffer', () => {
    requestLogService.record(entry('/a'));
    requestLogService.clear();
    expect(requestLogService.getAll()).toEqual([]);
  });
});
