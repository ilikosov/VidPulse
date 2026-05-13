import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';

const mockRows = [{ id: 1 }];

function makeQuery() {
  const q: any = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    whereNot: vi.fn().mockReturnThis(),
    whereNotIn: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(mockRows),
    count: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({ count: '1' }),
  };
  return q;
}

const knexMock: any = vi.fn((table: string) => makeQuery());
vi.mock('../db', () => ({ default: knexMock }));
vi.mock('../models/videoStatus', () => ({ VALID_STATUSES: ['new'], isValidStatus: () => true }));

describe('videos pagination', async () => {
  const { default: router } = await import('./video.routes');

  it('returns requested page and limit', async () => {
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/videos?page=2&limit=10`);
    const body = await res.json();
    server.close();
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
  });
});
