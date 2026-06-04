import knex from '../db';

type EntityField = 'group' | 'artist' | 'song' | 'event';

type VideoRow = {
  id: number;
  group_name: string | null;
  artist_name: string | null;
  song_title: string | null;
  event: string | null;
  group_id: number | null;
  artist_id: number | null;
  song_id: number | null;
  event_id: number | null;
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeEvent(value: string): string {
  return normalize(value.replace(/^@+/, ''));
}

function addUnmatched(bucket: Map<string, number>, value: string): void {
  const key = value.trim();
  if (!key) return;
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

function mapFromRows<T extends { id: number }>(
  rows: T[],
  valueSelector: (row: T) => string,
  normalizer: (value: string) => string = normalize,
): Map<string, number> {
  const mapped = new Map<string, number>();
  for (const row of rows) {
    const normalized = normalizer(valueSelector(row));
    if (normalized && !mapped.has(normalized)) {
      mapped.set(normalized, row.id);
    }
  }
  return mapped;
}

async function buildResolverMaps() {
  const [groups, artists, songs, events, aliases] = await Promise.all([
    knex('dictionary_groups').select('id', 'name'),
    knex('dictionary_artists').select('id', 'name'),
    knex('dictionary_songs').select('id', 'title'),
    knex('dictionary_events').select('id', 'name'),
    knex('dictionary_aliases').select('entity_type', 'entity_id', 'alias'),
  ]);

  const groupMap = mapFromRows(groups, (x) => x.name);
  const artistMap = mapFromRows(artists, (x) => x.name);
  const songMap = mapFromRows(songs, (x) => x.title);
  const eventMap = mapFromRows(events, (x) => x.name, normalizeEvent);

  const groupIds = new Set(groups.map((x) => x.id));
  const artistIds = new Set(artists.map((x) => x.id));
  const songIds = new Set(songs.map((x) => x.id));
  const eventIds = new Set(events.map((x) => x.id));

  for (const alias of aliases) {
    const entityType = String(alias.entity_type);
    const entityId = Number(alias.entity_id);
    const aliasValue = String(alias.alias ?? '');

    if (!aliasValue.trim()) continue;

    if (entityType === 'group' && groupIds.has(entityId)) {
      const key = normalize(aliasValue);
      if (key && !groupMap.has(key)) groupMap.set(key, entityId);
    }
    if (entityType === 'artist' && artistIds.has(entityId)) {
      const key = normalize(aliasValue);
      if (key && !artistMap.has(key)) artistMap.set(key, entityId);
    }
    if (entityType === 'song' && songIds.has(entityId)) {
      const key = normalize(aliasValue);
      if (key && !songMap.has(key)) songMap.set(key, entityId);
    }
    if (entityType === 'event' && eventIds.has(entityId)) {
      const key = normalizeEvent(aliasValue);
      if (key && !eventMap.has(key)) eventMap.set(key, entityId);
    }
  }

  return { groupMap, artistMap, songMap, eventMap };
}

async function backfill(): Promise<void> {
  const videos = (await knex('videos').select(
    'id',
    'group_name',
    'artist_name',
    'song_title',
    'event',
    'group_id',
    'artist_id',
    'song_id',
    'event_id',
  )) as VideoRow[];

  const { groupMap, artistMap, songMap, eventMap } = await buildResolverMaps();

  let matchedGroups = 0;
  let matchedArtists = 0;
  let matchedSongs = 0;
  let matchedEvents = 0;

  const unmatched: Record<EntityField, Map<string, number>> = {
    group: new Map<string, number>(),
    artist: new Map<string, number>(),
    song: new Map<string, number>(),
    event: new Map<string, number>(),
  };

  for (const video of videos) {
    const patch: Partial<VideoRow> = {};

    if (!video.group_id && video.group_name?.trim()) {
      const resolved = groupMap.get(normalize(video.group_name));
      if (resolved) {
        patch.group_id = resolved;
        matchedGroups++;
      } else {
        addUnmatched(unmatched.group, video.group_name);
      }
    }

    if (!video.artist_id && video.artist_name?.trim()) {
      const resolved = artistMap.get(normalize(video.artist_name));
      if (resolved) {
        patch.artist_id = resolved;
        matchedArtists++;
      } else {
        addUnmatched(unmatched.artist, video.artist_name);
      }
    }

    // Songs are no longer stored on `videos` (TASK-3) — they live in video_songs.

    if (!video.event_id && video.event?.trim()) {
      const resolved = eventMap.get(normalizeEvent(video.event));
      if (resolved) {
        patch.event_id = resolved;
        matchedEvents++;
      } else {
        addUnmatched(unmatched.event, video.event);
      }
    }

    if (Object.keys(patch).length > 0) {
      await knex('videos').where({ id: video.id }).update(patch);
    }
  }

  const serializeUnmatched = (items: Map<string, number>) =>
    Array.from(items.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));

  const report = {
    totalVideos: videos.length,
    matched: {
      groups: matchedGroups,
      artists: matchedArtists,
      songs: matchedSongs,
      events: matchedEvents,
    },
    unmatched: {
      group: serializeUnmatched(unmatched.group),
      artist: serializeUnmatched(unmatched.artist),
      song: serializeUnmatched(unmatched.song),
      event: serializeUnmatched(unmatched.event),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

backfill()
  .then(async () => {
    await knex.destroy();
  })
  .catch(async (error: unknown) => {
    console.error('Backfill failed:', error);
    await knex.destroy();
    process.exit(1);
  });
