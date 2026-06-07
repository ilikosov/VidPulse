import { Router, Request, Response } from 'express';
import multer from 'multer';
import { logger } from '../lib/logger';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  groupService,
  artistService,
  songService,
  eventService,
  aliasService,
  statsService,
  mediaLibraryService,
  type DictionaryGroupType,
} from '../services/dictionary';
import { mediaLibraryImportJobsService } from '../services/mediaLibraryImportJobs.service';
import { buildPaginationMeta, getPaginationParams } from './pagination';
import { validateMediaLibraryPayload } from '../services/mediaLibrarySchema.service';
import {
  dangerousActionsEnabled,
  requireDangerousActionsEnabled,
} from '../middleware/dangerousActions';
import { validateBody, validateParams } from '../middleware/validate';
import dictionaryGroupSchema from '../../schemas/request/dictionary-group.schema.json';
import dictionaryArtistSchema from '../../schemas/request/dictionary-artist.schema.json';
import dictionarySongSchema from '../../schemas/request/dictionary-song.schema.json';
import dictionaryEventSchema from '../../schemas/request/dictionary-event.schema.json';
import dictionaryAliasSchema from '../../schemas/request/dictionary-alias.schema.json';
import paramsIdSchema from '../../schemas/request/params-id.schema.json';
import paramsEntitySchema from '../../schemas/request/params-entity.schema.json';
import paramsEntityAliasSchema from '../../schemas/request/params-entity-alias.schema.json';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
type TemplateEntity = 'groups' | 'artists' | 'songs' | 'events';
type AliasEntityType = 'group' | 'artist' | 'song' | 'event';
const aliasEntityMap: Record<string, AliasEntityType> = {
  group: 'group',
  groups: 'group',
  artist: 'artist',
  artists: 'artist',
  song: 'song',
  songs: 'song',
  event: 'event',
  events: 'event',
};

const dictionaryTemplates: Record<TemplateEntity, Record<string, string>> = {
  groups: { name: '', type: 'female' },
  artists: { name: '', group_name: '' },
  songs: { title: '', artist: '' },
  events: { name: '' },
};

router.get(
  '/groups/list',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const [groups, total] = await Promise.all([
      groupService.getGroups(
        req.query.type as string | undefined,
        req.query.q as string | undefined,
        limit,
        offset,
      ),
      groupService.countGroups(
        req.query.type as string | undefined,
        req.query.q as string | undefined,
      ),
    ]);
    return res.json({ groups, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.post(
  '/groups',
  validateBody(dictionaryGroupSchema),
  asyncHandler(async (req, res) => {
    const { name, type, active } = req.body as {
      name: string;
      type: DictionaryGroupType;
      active?: boolean;
    };
    await groupService.createGroup({ name, type, active });
    res.status(201).json({ ok: true });
  }),
);

router.put(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    await groupService.updateGroup(Number(req.params.id), req.body);
    res.json({ ok: true });
  }),
);

router.delete(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    await groupService.deleteGroup(Number(req.params.id));
    res.status(204).send();
  }),
);

router.get(
  '/artists/list',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const groupId = req.query.group_id ? Number(req.query.group_id) : undefined;
    const [artists, total] = await Promise.all([
      artistService.getArtists(groupId, req.query.q as string | undefined, limit, offset),
      artistService.countArtists(groupId, req.query.q as string | undefined),
    ]);
    return res.json({ artists, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.post(
  '/artists',
  validateBody(dictionaryArtistSchema),
  asyncHandler(async (req, res) => {
    const { name, group_id } = req.body as { name: string; group_id: number };
    await artistService.createArtist({ name, group_id });
    res.status(201).json({ ok: true });
  }),
);

router.put(
  '/artists/:id',
  asyncHandler(async (req, res) => {
    await artistService.updateArtist(Number(req.params.id), {
      name: req.body.name,
      group_id: Number(req.body.group_id),
    });
    res.json({ ok: true });
  }),
);

router.delete(
  '/artists/:id',
  asyncHandler(async (req, res) => {
    await artistService.deleteArtist(Number(req.params.id));
    res.status(204).send();
  }),
);

router.get(
  '/songs/list',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const [songs, total] = await Promise.all([
      songService.getSongs(req.query.q as string | undefined, limit, offset),
      songService.countSongs(req.query.q as string | undefined),
    ]);
    return res.json({ songs, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.post(
  '/songs',
  validateBody(dictionarySongSchema),
  asyncHandler(async (req, res) => {
    const { title, artist, artist_ids, group_ids } = req.body as {
      title: string;
      artist: string;
      artist_ids?: number[];
      group_ids?: number[];
    };
    await songService.createSong({ title, artist, artist_ids, group_ids });
    res.status(201).json({ ok: true });
  }),
);

router.put(
  '/songs/:id',
  asyncHandler(async (req, res) => {
    const { title, artist, artist_ids, group_ids } = req.body;
    await songService.updateSong(Number(req.params.id), {
      title,
      artist,
      artist_ids,
      group_ids,
    });
    res.json({ ok: true });
  }),
);

router.delete(
  '/songs/:id',
  asyncHandler(async (req, res) => {
    await songService.deleteSong(Number(req.params.id));
    res.status(204).send();
  }),
);

router.get(
  '/groups/:id/artists',
  asyncHandler(async (req, res) => {
    const groupId = Number(req.params.id);
    const group = await groupService.getGroupById(groupId);
    if (!group) return res.status(404).json({ error: { message: 'Group not found' } });
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const [artists, total] = await Promise.all([
      groupService.getGroupArtists(groupId, limit, offset),
      groupService.countGroupArtists(groupId),
    ]);
    return res.json({ artists, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.get(
  '/groups/:id/songs',
  asyncHandler(async (req, res) => {
    const groupId = Number(req.params.id);
    const group = await groupService.getGroupById(groupId);
    if (!group) return res.status(404).json({ error: { message: 'Group not found' } });
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const [songs, total] = await Promise.all([
      groupService.getGroupSongs(groupId, limit, offset),
      groupService.countGroupSongs(groupId),
    ]);
    return res.json({ songs, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.get(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    const group = await groupService.getGroupById(Number(req.params.id));
    if (!group) return res.status(404).json({ error: { message: 'Group not found' } });
    return res.json(group);
  }),
);

router.get(
  '/groups/:id/videos',
  asyncHandler(async (req, res) => {
    const group = await groupService.getGroupById(Number(req.params.id));
    if (!group) return res.status(404).json({ error: { message: 'Group not found' } });
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return res.json(await groupService.getVideosByGroupId(Number(req.params.id), page, limit));
  }),
);

router.get(
  '/artists/:id',
  asyncHandler(async (req, res) => {
    const artist = await artistService.getArtistById(Number(req.params.id));
    if (!artist) return res.status(404).json({ error: { message: 'Artist not found' } });
    return res.json(artist);
  }),
);

router.get(
  '/artists/:id/songs',
  asyncHandler(async (req, res) => {
    const artistId = Number(req.params.id);
    const artist = await artistService.getArtistById(artistId);
    if (!artist) return res.status(404).json({ error: { message: 'Artist not found' } });
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const [songs, total] = await Promise.all([
      artistService.getArtistSongs(artistId, limit, offset),
      artistService.countArtistSongs(artistId),
    ]);
    return res.json({ songs, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.get(
  '/artists/:id/videos',
  asyncHandler(async (req, res) => {
    const artist = await artistService.getArtistById(Number(req.params.id));
    if (!artist) return res.status(404).json({ error: { message: 'Artist not found' } });
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return res.json(await artistService.getVideosByArtistId(Number(req.params.id), page, limit));
  }),
);

router.get(
  '/songs/:id',
  asyncHandler(async (req, res) => {
    const song = await songService.getSongById(Number(req.params.id));
    if (!song) return res.status(404).json({ error: { message: 'Song not found' } });
    return res.json(song);
  }),
);

router.get(
  '/songs/:id/videos',
  asyncHandler(async (req, res) => {
    const song = await songService.getSongById(Number(req.params.id));
    if (!song) return res.status(404).json({ error: { message: 'Song not found' } });
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return res.json(await songService.getVideosBySongId(Number(req.params.id), page, limit));
  }),
);

router.get(
  '/:entityType/:entityId/aliases',
  validateParams(paramsEntitySchema),
  asyncHandler(async (req, res) => {
    const entityType = aliasEntityMap[req.params.entityType as string];
    const entityId = Number(req.params.entityId);
    if (!entityType || !entityId)
      return res.status(400).json({ error: { message: 'Invalid entity parameters' } });
    return res.json(await aliasService.getAliases(entityType, entityId));
  }),
);

router.post(
  '/:entityType/:entityId/aliases',
  validateParams(paramsEntitySchema),
  validateBody(dictionaryAliasSchema),
  asyncHandler(async (req, res) => {
    const entityType = aliasEntityMap[req.params.entityType as string];
    const entityId = Number(req.params.entityId);
    const alias: string = req.body.alias;
    if (!entityType || !entityId)
      return res.status(400).json({ error: { message: 'Invalid entity parameters' } });
    const existing = await aliasService.getAliases(entityType, entityId);
    if (existing.some((item) => item.alias.toLowerCase() === alias.toLowerCase())) {
      return res.status(409).json({ error: { message: 'Alias already exists' } });
    }
    const created = await aliasService.addAlias(entityType, entityId, alias);
    return res.status(201).json(created);
  }),
);

router.delete(
  '/:entityType/:entityId/aliases/:aliasId',
  validateParams(paramsEntityAliasSchema),
  asyncHandler(async (req, res) => {
    const entityType = aliasEntityMap[req.params.entityType as string];
    const entityId = Number(req.params.entityId);
    const aliasId = Number(req.params.aliasId);
    if (!entityType || !entityId || !aliasId)
      return res.status(400).json({ error: { message: 'Invalid entity parameters' } });
    await aliasService.removeAlias(entityType, entityId, aliasId);
    return res.status(204).send();
  }),
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    return res.json(await statsService.getStats());
  }),
);

router.get(
  '/events/list',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPaginationParams(req, 20, 100);
    const [events, total] = await Promise.all([
      eventService.getEvents(req.query.q as string | undefined, limit, offset),
      eventService.countEvents(req.query.q as string | undefined),
    ]);
    return res.json({ events, pagination: buildPaginationMeta(page, limit, total) });
  }),
);

router.post(
  '/events',
  validateBody(dictionaryEventSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name: string };
    await eventService.createEvent({ name });
    res.status(201).json({ ok: true });
  }),
);

router.put(
  '/events/:id',
  asyncHandler(async (req, res) => {
    await eventService.updateEvent(Number(req.params.id), req.body);
    res.json({ ok: true });
  }),
);

router.delete(
  '/events/:id',
  asyncHandler(async (req, res) => {
    await eventService.deleteEvent(Number(req.params.id));
    res.status(204).send();
  }),
);

router.get(
  '/events/:id',
  asyncHandler(async (req, res) => {
    const events = await eventService.getEvents(undefined, 10000, 0);
    const event = events.find((item: any) => item.id === Number(req.params.id));
    if (!event) return res.status(404).json({ error: { message: 'Event not found' } });
    return res.json(event);
  }),
);

router.get(
  '/events/:id/videos',
  asyncHandler(async (req, res) => {
    const events = await eventService.getEvents(undefined, 10000, 0);
    const event = events.find((item: any) => item.id === Number(req.params.id));
    if (!event) return res.status(404).json({ error: { message: 'Event not found' } });
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return res.json(await eventService.getVideosByEventId(Number(req.params.id), page, limit));
  }),
);

router.get('/template/:entity/:format', (req, res) => {
  const format = req.params.format.toLowerCase();
  if (format === 'csv') {
    return res
      .status(410)
      .json({ error: { message: 'CSV templates are deprecated. Use /api/dictionary/schema' } });
  }
  if (format === 'json') {
    return res.redirect(302, '/api/dictionary/example');
  }
  return res.status(400).json({ error: { message: 'unsupported format' } });
});

router.get('/schema', (_req, res) => {
  return res.download('schemas/media-library.schema.json', 'media-library.schema.json');
});

router.get('/example', (_req, res) => {
  return res.download('examples/media-library.example.json', 'media-library.example.json');
});

router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const payload = await mediaLibraryService.exportMediaLibrary();
    res.setHeader('Content-Disposition', 'attachment; filename="vidpulse-media-library.json"');
    return res.type('application/json').send(JSON.stringify(payload, null, 2));
  }),
);

router.delete(
  '/clear',
  requireDangerousActionsEnabled,
  asyncHandler(async (_req, res) => {
    const summary = await mediaLibraryService.clearMediaLibrary();
    return res.json(summary);
  }),
);

router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: { message: 'file is required' } });
    const name = req.file.originalname.toLowerCase();
    if (!name.endsWith('.json'))
      return res
        .status(400)
        .json({ error: { message: 'Only media library JSON files are supported' } });

    let payload: unknown;
    try {
      payload = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch {
      return res
        .status(400)
        .json({ error: { message: 'Invalid media library JSON', details: ['Invalid JSON'] } });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return res.status(400).json({
        error: { message: 'Invalid media library JSON', details: ['Payload must be an object'] },
      });

    const validationResult = validateMediaLibraryPayload(payload);
    if (!validationResult.valid)
      return res.status(400).json({
        error: { message: 'Invalid media library JSON', details: validationResult.errors },
      });

    const mode = (payload as Record<string, unknown>).mode;
    if (mode === 'replace' && !dangerousActionsEnabled())
      return res
        .status(403)
        .json({ error: { message: 'Dangerous media library actions are disabled' } });

    const p = payload as Record<string, unknown>;
    const groups = Array.isArray(p.groups) ? p.groups : [];
    const soloArtists = Array.isArray(p.soloArtists) ? p.soloArtists : [];
    const events = Array.isArray(p.events) ? p.events : [];
    const total =
      groups.length +
      groups.reduce(
        (acc: number, g: any) => acc + (Array.isArray(g.artists) ? g.artists.length : 0),
        0,
      ) +
      groups.reduce(
        (acc: number, g: any) =>
          acc +
          (Array.isArray(g.artists)
            ? g.artists.reduce(
                (a: number, ar: any) => a + (Array.isArray(ar.songs) ? ar.songs.length : 0),
                0,
              )
            : 0),
        0,
      ) +
      groups.reduce(
        (acc: number, g: any) => acc + (Array.isArray(g.songs) ? g.songs.length : 0),
        0,
      ) +
      soloArtists.length +
      soloArtists.reduce(
        (acc: number, a: any) => acc + (Array.isArray(a.songs) ? a.songs.length : 0),
        0,
      ) +
      events.length;

    const job = mediaLibraryImportJobsService.createJob(total);
    mediaLibraryImportJobsService.updateJob(job.jobId, {
      status: 'running',
      phase: 'validating',
      message: 'Validating JSON',
    });

    void (async () => {
      try {
        if (mode === 'replace') {
          mediaLibraryImportJobsService.updateJob(job.jobId, {
            phase: 'clearing',
            message: 'Clearing existing dictionary data',
          });
          await mediaLibraryService.clearMediaLibrary();
        }
        const summary = await mediaLibraryService.importMediaLibrary(payload, {
          onProgress: (progress) =>
            mediaLibraryImportJobsService.updateJob(job.jobId, {
              status: 'running',
              phase: progress.phase,
              processed: progress.processed,
              total: progress.total,
              message: progress.message,
            }),
        });
        mediaLibraryImportJobsService.completeJob(job.jobId, summary);
      } catch (error: unknown) {
        mediaLibraryImportJobsService.failJob(
          job.jobId,
          error instanceof Error ? error.message : 'Unknown import error',
        );
      }
    })();

    return res.status(202).json({ jobId: job.jobId });
  }),
);

router.get('/import/:jobId/progress', (req, res) => {
  const job = mediaLibraryImportJobsService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: { message: 'Import job not found' } });
  return res.json(job);
});

router.get('/import/:jobId/result', (req, res) => {
  const job = mediaLibraryImportJobsService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: { message: 'Import job not found' } });
  if (job.status === 'completed') return res.json(job.summary);
  if (job.status === 'failed')
    return res.status(500).json({ error: { message: job.error || 'Import failed' } });
  return res.status(202).json({ status: job.status, percent: job.percent, message: job.message });
});

void dictionaryTemplates;
void paramsIdSchema;

export default router;
