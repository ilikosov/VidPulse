import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import router from './dictionary.routes';

vi.mock('../services/dictionary.service', () => ({
  dictionaryService: {
    getGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'G', type: 'female', active: 1 }]),
    countGroups: vi.fn().mockResolvedValue(1),
  },
}));

describe('dictionary routes pagination contract', () => {
  it('returns object with pagination for groups list', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/groups/list?page=1&limit=500`);
    const body = await res.json();
    server.close();

    expect(Array.isArray(body)).toBe(false);
    expect(body.groups).toBeDefined();
    expect(body.pagination).toMatchObject({ page: 1, limit: 100, total: 1 });
  });
});
