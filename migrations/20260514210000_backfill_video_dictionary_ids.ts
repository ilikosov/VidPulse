import type { Knex } from 'knex';

type EntityRow = { id: number; name: string };
type AliasRow = { entity_id: number; alias: string };

const normalize = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

async function buildLookup(
  knex: Knex,
  table: string,
  nameColumn: string,
  aliasType?: 'group' | 'artist' | 'song' | 'event',
) {
  const rows = (await knex(table).select('id', `${nameColumn} as name`)) as EntityRow[];
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(normalize(row.name), row.id));

  if (aliasType) {
    const aliases = (await knex('dictionary_aliases')
      .select('entity_id', 'alias')
      .where({ entity_type: aliasType })) as AliasRow[];
    aliases.forEach((alias) => {
      if (!map.has(normalize(alias.alias))) map.set(normalize(alias.alias), alias.entity_id);
    });
  }

  return map;
}

export async function up(knex: Knex): Promise<void> {
  const groupLookup = await buildLookup(knex, 'dictionary_groups', 'name', 'group');
  const artistLookup = await buildLookup(knex, 'dictionary_artists', 'name', 'artist');
  const songLookup = await buildLookup(knex, 'dictionary_songs', 'title', 'song');
  const eventLookup = await buildLookup(knex, 'dictionary_events', 'name');

  const videos = await knex('videos').select(
    'id',
    'group_name',
    'artist_name',
    'song_title',
    'event',
    'group_id',
    'artist_id',
    'song_id',
    'event_id',
  );

  for (const video of videos) {
    const next: Record<string, number | null> = {};

    if (!video.group_id) {
      const resolved = groupLookup.get(normalize(video.group_name));
      if (resolved) next.group_id = resolved;
    }
    if (!video.artist_id) {
      const resolved = artistLookup.get(normalize(video.artist_name));
      if (resolved) next.artist_id = resolved;
    }
    if (!video.song_id) {
      const resolved = songLookup.get(normalize(video.song_title));
      if (resolved) next.song_id = resolved;
    }
    if (!video.event_id) {
      const resolved = eventLookup.get(normalize(video.event));
      if (resolved) next.event_id = resolved;
    }

    if (Object.keys(next).length) {
      await knex('videos').where({ id: video.id }).update(next);
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  // no-op: keep filled IDs
}
