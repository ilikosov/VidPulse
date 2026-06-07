import { describe, it, expect } from 'vitest';
import * as http from 'node:http';
import { createApp } from './index';

function request(server: http.Server, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.get(`http://127.0.0.1:${addr.port}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
    });
    req.on('error', reject);
  });
}

describe('createApp', () => {
  it('returns an express app without binding a port', () => {
    const { app } = createApp();
    expect(typeof app).toBe('function');
    expect(typeof app.listen).toBe('function');
  });

  it('health endpoint responds ok', async () => {
    const { app } = createApp();
    const server = app.listen(0);
    try {
      const res = await request(server, '/api/health');
      expect(res.status).toBe(200);
      expect((res.body as { status: string }).status).toBe('ok');
    } finally {
      server.close();
    }
  });

  it('unknown api route returns 404', async () => {
    const { app } = createApp();
    const server = app.listen(0);
    try {
      const res = await request(server, '/api/nonexistent-route-xyz');
      expect(res.status).toBe(404);
      expect((res.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    } finally {
      server.close();
    }
  });
});
