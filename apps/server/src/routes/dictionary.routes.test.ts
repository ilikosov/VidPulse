import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import router from './dictionary.routes';
import { validateMediaLibraryPayload } from '../services/mediaLibrarySchema.service';

vi.mock('../services/dictionary.service', () => ({
  dictionaryService: {
    getGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'G', type: 'female', active: 1 }]),
    countGroups: vi.fn().mockResolvedValue(1),
    getGroupById: vi.fn().mockResolvedValue({ id: 1, name: 'G', type: 'female', active: true }),
    getArtistById: vi.fn().mockResolvedValue({ id: 10, name: 'A', group_id: 1, group_name: 'G' }),
    getSongById: vi.fn().mockResolvedValue({ id: 20, title: 'S', artist: 'A' }),
    getVideosByGroupId: vi.fn().mockResolvedValue({
      videos: [{ id: 100, group_id: 1, group_name: 'G' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    getVideosByArtistId: vi.fn().mockResolvedValue({
      videos: [{ id: 101, artist_id: 10, artist_name: 'A' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    getVideosBySongId: vi.fn().mockResolvedValue({
      videos: [{ id: 102, song_id: 20, song_title: 'S' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
    getStats: vi.fn().mockResolvedValue({
      groups: 1,
      artists: 1,
      songs: 1,
      events: 1,
      aliases: 1,
      videosLinkedToGroups: 1,
      videosLinkedToArtists: 1,
      videosLinkedToSongs: 1,
      videosLinkedToEvents: 1,
      unmatched: { groups: 0, artists: 0, songs: 0, events: 0 },
    }),
    importMediaLibrary: vi.fn().mockResolvedValue({
      mode: 'merge',
      groups: { inserted: 0, updated: 0, aliasesInserted: 0 },
      artists: { inserted: 0, updated: 0, aliasesInserted: 0, membershipsInserted: 0 },
      songs: {
        inserted: 0,
        updated: 0,
        aliasesInserted: 0,
        artistLinksInserted: 0,
        groupLinksInserted: 0,
      },
      events: { inserted: 0, updated: 0, aliasesInserted: 0 },
      errors: [],
    }),
    exportMediaLibrary: vi.fn().mockResolvedValue({
      version: 1,
      mode: 'merge',
      exportedAt: '2026-05-15T00:00:00.000Z',
      groups: [
        {
          name: 'G',
          type: 'female',
          active: true,
          aliases: ['GG'],
          artists: [
            {
              name: 'A',
              aliases: ['AA'],
              membership: {
                activityType: 'group',
                status: 'active',
                from: null,
                to: null,
                isPrimary: true,
              },
              songs: [{ title: 'S', aliases: [] }],
            },
          ],
          songs: [],
        },
      ],
      soloArtists: [
        {
          name: 'SOLO A',
          aliases: [],
          membership: {
            activityType: 'solo',
            status: 'active',
            from: null,
            to: null,
            isPrimary: true,
          },
          songs: [{ title: 'SOLO SONG', aliases: [] }],
        },
      ],
      events: [{ name: 'EV', aliases: ['EVA'] }],
    }),
    clearMediaLibrary: vi.fn().mockResolvedValue({
      cleared: {
        groups: 1,
        artists: 1,
        songs: 1,
        events: 1,
        aliases: 1,
        memberships: 1,
        songArtistLinks: 1,
        songGroupLinks: 1,
      },
      videosUpdated: 2,
    }),
  },
}));

describe('dictionary routes pagination contract', () => {
  it('returns object with pagination for groups list', async () => {
    /* unchanged */
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

  it('uses ID-based videos query for group page', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(
      `http://127.0.0.1:${port}/api/dictionary/groups/1/videos?page=2&limit=5`,
    );
    const body = await res.json();
    server.close();
    expect(res.status).toBe(200);
    expect(body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    const svc = (await import('../services/dictionary.service')).dictionaryService as any;
    expect(svc.getVideosByGroupId).toHaveBeenCalledWith(1, 2, 5);
  });

  it('uses ID-based videos query for artist and song pages', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const artistRes = await fetch(
      `http://127.0.0.1:${port}/api/dictionary/artists/10/videos?page=1&limit=7`,
    );
    const songRes = await fetch(
      `http://127.0.0.1:${port}/api/dictionary/songs/20/videos?page=3&limit=9`,
    );
    server.close();
    expect(artistRes.status).toBe(200);
    expect(songRes.status).toBe(200);
    const svc = (await import('../services/dictionary.service')).dictionaryService as any;
    expect(svc.getVideosByArtistId).toHaveBeenCalledWith(10, 1, 7);
    expect(svc.getVideosBySongId).toHaveBeenCalledWith(20, 3, 9);
  });
});

it('returns dictionary stats payload', async () => {
  const app = express();
  app.use('/api/dictionary', router);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/stats`);
  const body = await res.json();
  server.close();
  expect(res.status).toBe(200);
  expect(body).toMatchObject({
    groups: 1,
    artists: 1,
    songs: 1,
    events: 1,
    aliases: 1,
    unmatched: { groups: 0, artists: 0, songs: 0, events: 0 },
  });
});

describe('dictionary media library import', () => {
  it('returns 403 for mode=replace when dangerous actions disabled', async () => {
    process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED = 'false';
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const payload = { version: 1, mode: 'replace', groups: [], soloArtists: [], events: [] };
    const form = new FormData();
    form.append(
      'file',
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      'import.json',
    );
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/import`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();
    server.close();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Dangerous media library actions are disabled');
  });

  it('returns 400 for csv import', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const form = new FormData();
    form.append('file', new Blob(['a,b\n1,2'], { type: 'text/csv' }), 'import.csv');
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/import`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();
    server.close();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: 'Only media library JSON files are supported' });
  });

  it('returns 400 for json array import', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const form = new FormData();
    form.append(
      'file',
      new Blob([JSON.stringify([])], { type: 'application/json' }),
      'import.json',
    );
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/import`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();
    server.close();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid media library JSON');
  });

  it('returns 400 with details for invalid schema', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const form = new FormData();
    form.append(
      'file',
      new Blob([JSON.stringify({ version: 2 })], { type: 'application/json' }),
      'import.json',
    );
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/import`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();
    server.close();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid media library JSON');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('calls importMediaLibrary for valid json payload', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const payload = { version: 1, mode: 'merge', groups: [], soloArtists: [], events: [] };
    const form = new FormData();
    form.append(
      'file',
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      'import.json',
    );
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/import`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();
    server.close();
    expect(res.status).toBe(202);
    expect(body.jobId).toBeTypeOf('string');
  });

  it('returns job progress and result endpoints', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const payload = { version: 1, mode: 'merge', groups: [], soloArtists: [], events: [] };
    const form = new FormData();
    form.append(
      'file',
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      'import.json',
    );
    const importRes = await fetch(`http://127.0.0.1:${port}/api/dictionary/import`, {
      method: 'POST',
      body: form,
    });
    const importBody = await importRes.json();
    const progressRes = await fetch(
      `http://127.0.0.1:${port}/api/dictionary/import/${importBody.jobId}/progress`,
    );
    const progressBody = await progressRes.json();
    const resultRes = await fetch(
      `http://127.0.0.1:${port}/api/dictionary/import/${importBody.jobId}/result`,
    );
    server.close();
    expect(progressRes.status).toBe(200);
    expect(['queued', 'running', 'completed']).toContain(progressBody.status);
    expect([200, 202]).toContain(resultRes.status);
  });
});

describe('dictionary clear endpoint', () => {
  it('returns 403 when dangerous actions are disabled', async () => {
    process.env.MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED = 'false';
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/clear`, { method: 'DELETE' });
    const body = await res.json();
    server.close();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Dangerous media library actions are disabled');
  });
});

describe('dictionary media library export', () => {
  it('returns export attachment and valid schema payload', async () => {
    const app = express();
    app.use('/api/dictionary', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/dictionary/export`);
    const body = await res.json();
    server.close();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toContain('vidpulse-media-library.json');
    const validation = validateMediaLibraryPayload(body);
    expect(validation.valid).toBe(true);
  });
});
