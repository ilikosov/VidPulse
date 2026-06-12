import { knex } from '@vidpulse/db';
import type Knex from 'knex';
import { getVideoSongsMap } from '../parser/videoSongs.service';

export type AliasEntityType = 'group' | 'artist' | 'song' | 'event';
export type MembershipActivityType = 'group' | 'solo';
export type MembershipStatus = 'active' | 'former' | 'hiatus';
export type DictionaryGroupType = 'male' | 'female' | 'mixed';

export type DbClient = typeof knex;

export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function toTypes(raw?: string): DictionaryGroupType[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is DictionaryGroupType => ['male', 'female', 'mixed'].includes(x));
}

export async function addAliasesIfMissing(
  db: DbClient,
  entityType: AliasEntityType,
  entityId: number,
  aliases: unknown,
  canonicalName: string,
): Promise<number> {
  if (!Array.isArray(aliases)) return 0;

  let inserted = 0;
  const normalizedCanonical = normalizeName(canonicalName);
  for (const rawAlias of aliases) {
    const alias = String(rawAlias ?? '').trim();
    if (!alias) continue;
    if (normalizeName(alias) === normalizedCanonical) continue;

    const existingAlias = await db('dictionary_aliases')
      .where({ entity_type: entityType, entity_id: entityId })
      .andWhereRaw('LOWER(alias) = ?', [alias.toLowerCase()])
      .first();
    if (existingAlias) continue;

    await db('dictionary_aliases').insert({
      entity_type: entityType,
      entity_id: entityId,
      alias,
    });
    inserted += 1;
  }

  return inserted;
}

export function upsertMembership(payload: {
  artist_id: number;
  group_id: number | null;
  activity_type: MembershipActivityType;
  status: MembershipStatus;
  started_at?: string | null;
  ended_at?: string | null;
  is_primary?: boolean;
}) {
  // Direct knex usage for simple upsert
}

export async function attachSongs<T extends { id: number }>(
  videos: T[],
): Promise<Array<T & { songs: Array<{ id: number | null; title: string }> }>> {
  const songsByVideo = await getVideoSongsMap(videos.map((video) => video.id));
  return videos.map((video) => ({ ...video, songs: songsByVideo.get(video.id) ?? [] }));
}
