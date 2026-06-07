import { describe, it, expect } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { validateBody, validateParams, validateQuery } from './validate';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: { name: { type: 'string', minLength: 1 } },
};

describe('validateBody', () => {
  it('passes valid body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(schema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'hello' }),
    });
    server.close();
    expect(res.status).toBe(200);
  });

  it('rejects missing required field', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(schema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    server.close();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Validation failed',
      details: ["/ must have required property 'name'"],
    });
  });

  it('rejects empty string', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(schema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    server.close();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('rejects additional properties', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(schema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'a', extra: 1 }),
    });
    server.close();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Validation failed',
      details: ['/ must NOT have additional properties'],
    });
  });
});

describe('validateParams', () => {
  const paramSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  };

  it('passes valid numeric param (coerced from string)', async () => {
    const app = express();
    app.get('/test/:id', validateParams(paramSchema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test/42`);
    server.close();
    expect(res.status).toBe(200);
  });

  it('rejects non-numeric param', async () => {
    const app = express();
    app.get('/test/:id', validateParams(paramSchema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test/abc`);
    server.close();
    expect(res.status).toBe(400);
  });

  it('rejects param below minimum', async () => {
    const app = express();
    app.get('/test/:id', validateParams(paramSchema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test/0`);
    server.close();
    expect(res.status).toBe(400);
  });
});

describe('validateQuery', () => {
  const querySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  };

  it('passes valid query params (coerced from string)', async () => {
    const app = express();
    app.get('/test', validateQuery(querySchema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test?page=1&limit=50`);
    server.close();
    expect(res.status).toBe(200);
  });

  it('rejects query param below minimum', async () => {
    const app = express();
    app.get('/test', validateQuery(querySchema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test?page=0`);
    server.close();
    expect(res.status).toBe(400);
  });

  it('rejects string where number expected', async () => {
    const app = express();
    app.get('/test', validateQuery(querySchema as any), (_req, res) => {
      res.json({ ok: true });
    });
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/test?page=abc`);
    server.close();
    expect(res.status).toBe(400);
  });
});
