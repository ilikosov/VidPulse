import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import router from './dictionary.routes';

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
  const svc = (await import('../services/dictionary.service')).dictionaryService as any;
  expect(svc.getStats).toHaveBeenCalled();
});
