import { describe, it, expect } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import router from './video';

// Runs against the dedicated, migrated test DB (see tests/vitest.global-setup.ts).
// With no videos seeded the endpoint still echoes the requested pagination.
describe('videos pagination', () => {
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
