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

/**
 * A scalar-subquery `SELECT` for the entity's primary alias, aliased as `display_name`. Used
 * alongside an entity's own name/title column so callers can render
 * `display_name ?? name` — the primary alias, when set, is what should be shown instead of the
 * canonical name (see docs/adr/0002-raw-parse-vs-canonical-display.md). A scalar subquery (rather
 * than a LEFT JOIN) keeps this independent of any existing GROUP BY/countDistinct aggregation on
 * the query it's added to.
 */
export function primaryAliasSelect(entityType: AliasEntityType, idColumn: string) {
  return knex.raw(
    `(SELECT alias FROM dictionary_aliases WHERE entity_type = ? AND entity_id = ${idColumn} AND is_primary = 1 LIMIT 1) AS display_name`,
    [entityType],
  );
}

export async function attachSongs<T extends { id: number }>(
  videos: T[],
): Promise<Array<T & { songs: Array<{ id: number | null; title: string }> }>> {
  const songsByVideo = await getVideoSongsMap(videos.map((video) => video.id));
  return videos.map((video) => ({ ...video, songs: songsByVideo.get(video.id) ?? [] }));
}
