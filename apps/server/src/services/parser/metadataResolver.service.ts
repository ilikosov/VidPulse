import { knex } from '@vidpulse/db';
import { ParsedMetadata } from './parser.types';

type DictionaryEntityType = 'group' | 'artist' | 'song' | 'event';

type ResolvedParsedMetadata = {
  group_id: number | null;
  artist_id: number | null;
  song_id: number | null;
  event_id: number | null;
  group_name: string | null;
  artist_name: string | null;
  song_title: string | null;
  event: string | null;
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeEvent(value: string): string {
  return normalize(value.replace(/^@+/, ''));
}

async function resolveEntity(
  entityType: DictionaryEntityType,
  value: string,
): Promise<{ id: number; canonical: string } | null> {
  const normalizedInput = entityType === 'event' ? normalizeEvent(value) : normalize(value);
  if (!normalizedInput) return null;

  const canonicalRow =
    entityType === 'group'
      ? await knex('dictionary_groups')
          .select('id', 'name')
          .whereRaw('LOWER(name) = ?', [normalizedInput])
          .first()
      : entityType === 'artist'
        ? await knex('dictionary_artists')
            .select('id', 'name')
            .whereRaw('LOWER(name) = ?', [normalizedInput])
            .first()
        : entityType === 'song'
          ? await knex('dictionary_songs')
              .select('id', 'title')
              .whereRaw('LOWER(title) = ?', [normalizedInput])
              .first()
          : await knex('dictionary_events')
              .select('id', 'name')
              .whereRaw("LOWER(REPLACE(name, '@', '')) = ?", [normalizedInput])
              .first();

  if (canonicalRow) {
    const canonical =
      entityType === 'song' ? String(canonicalRow.title) : String(canonicalRow.name);
    return { id: Number(canonicalRow.id), canonical };
  }

  const aliasRow = await knex('dictionary_aliases')
    .select('entity_id', 'alias')
    .where({ entity_type: entityType })
    .whereRaw(entityType === 'event' ? "LOWER(REPLACE(alias, '@', '')) = ?" : 'LOWER(alias) = ?', [
      normalizedInput,
    ])
    .first();

  if (!aliasRow) return null;

  const entityId = Number(aliasRow.entity_id);

  const entityRow =
    entityType === 'group'
      ? await knex('dictionary_groups').select('id', 'name').where({ id: entityId }).first()
      : entityType === 'artist'
        ? await knex('dictionary_artists').select('id', 'name').where({ id: entityId }).first()
        : entityType === 'song'
          ? await knex('dictionary_songs').select('id', 'title').where({ id: entityId }).first()
          : await knex('dictionary_events').select('id', 'name').where({ id: entityId }).first();

  if (!entityRow) return null;

  const canonical = entityType === 'song' ? String(entityRow.title) : String(entityRow.name);
  return { id: Number(entityRow.id), canonical };
}

export async function resolveParsedMetadata(
  metadata: Partial<ParsedMetadata>,
): Promise<ResolvedParsedMetadata> {
  const groupInput = metadata.group_name?.trim() ?? '';
  const artistInput = metadata.artist_name?.trim() ?? '';
  const songInput = metadata.song_title?.trim() ?? '';
  const eventInput = metadata.event?.trim() ?? '';

  const [group, artist, song, event] = await Promise.all([
    groupInput ? resolveEntity('group', groupInput) : Promise.resolve(null),
    artistInput ? resolveEntity('artist', artistInput) : Promise.resolve(null),
    songInput ? resolveEntity('song', songInput) : Promise.resolve(null),
    eventInput ? resolveEntity('event', eventInput) : Promise.resolve(null),
  ]);

  return {
    group_id: group?.id ?? null,
    artist_id: artist?.id ?? null,
    song_id: song?.id ?? null,
    event_id: event?.id ?? null,
    // Text columns hold the RAW parse result (evidence). The canonical value is
    // referenced via *_id; the display value is derived on read as
    // COALESCE(dictionary, raw) via the `videos_display` view (ADR 0002 / TASK-1).
    group_name: groupInput || null,
    artist_name: artistInput || null,
    // song_title stays a single-value legacy snapshot (canonical when matched);
    // the many-to-many song model is TASK-2.
    song_title: song ? song.canonical : songInput || null,
    event: eventInput || null,
  };
}

export function hasUnresolvedEntity(
  metadata: Partial<ParsedMetadata>,
  resolved: ResolvedParsedMetadata,
): boolean {
  const hasGroup = Boolean(metadata.group_name?.trim());
  const hasArtist = Boolean(metadata.artist_name?.trim());
  const hasSong = Boolean(metadata.song_title?.trim());
  const hasEvent = Boolean(metadata.event?.trim());

  return (
    (hasGroup && resolved.group_id == null) ||
    (hasArtist && resolved.artist_id == null) ||
    (hasSong && resolved.song_id == null) ||
    (hasEvent && resolved.event_id == null)
  );
}
