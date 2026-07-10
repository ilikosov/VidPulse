import { knex } from '@vidpulse/db';
import type { AliasEntityType } from './utils';

/** better-sqlite3 returns boolean columns as raw 0/1; coerce to a real boolean at the boundary. */
function withBooleanPrimary<T extends { is_primary: unknown }>(
  row: T,
): T & { is_primary: boolean } {
  return { ...row, is_primary: Boolean(row.is_primary) };
}

export class AliasService {
  async getAliases(entityType: AliasEntityType, entityId: number) {
    const rows = await knex('dictionary_aliases')
      .select('id', 'alias', 'is_primary')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy([{ column: 'is_primary', order: 'desc' }, 'alias']);
    return rows.map(withBooleanPrimary);
  }

  async addAlias(entityType: AliasEntityType, entityId: number, alias: string) {
    const trimmedAlias = alias.trim();
    const [id] = await knex('dictionary_aliases').insert({
      entity_type: entityType,
      entity_id: entityId,
      alias: trimmedAlias,
    });
    const row = await knex('dictionary_aliases')
      .select('id', 'alias', 'is_primary')
      .where({ id })
      .first();
    return withBooleanPrimary(row);
  }

  async removeAlias(entityType: AliasEntityType, entityId: number, aliasId: number) {
    return knex('dictionary_aliases')
      .where({ id: aliasId, entity_type: entityType, entity_id: entityId })
      .delete();
  }

  /**
   * Marks (or unmarks) an alias as the one to display instead of the entity's canonical
   * name/title. Setting one primary unsets any previous primary for the same entity (single
   * primary, enforced by the partial unique index on dictionary_aliases). Returns the updated
   * alias, or null if it doesn't belong to the given entity.
   */
  async setPrimaryAlias(
    entityType: AliasEntityType,
    entityId: number,
    aliasId: number,
    isPrimary: boolean,
  ) {
    return knex.transaction(async (trx) => {
      const alias = await trx('dictionary_aliases')
        .where({ id: aliasId, entity_type: entityType, entity_id: entityId })
        .first();
      if (!alias) return null;

      if (isPrimary) {
        await trx('dictionary_aliases')
          .where({ entity_type: entityType, entity_id: entityId, is_primary: true })
          .update({ is_primary: false });
      }
      await trx('dictionary_aliases').where({ id: aliasId }).update({ is_primary: isPrimary });

      const updated = await trx('dictionary_aliases')
        .select('id', 'alias', 'is_primary')
        .where({ id: aliasId })
        .first();
      return withBooleanPrimary(updated);
    });
  }

  async getAllAliases(entityType?: AliasEntityType) {
    const query = knex('dictionary_aliases')
      .select('id', 'entity_type', 'entity_id', 'alias')
      .orderBy('alias');
    if (entityType) query.where({ entity_type: entityType });
    return query;
  }

  async resolveAlias(entityType: AliasEntityType, name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;
    const aliasRow = await knex('dictionary_aliases')
      .whereRaw('LOWER(alias) = ?', [normalized])
      .andWhere({ entity_type: entityType })
      .first();
    if (!aliasRow) return null;
    if (entityType === 'group') {
      const group = await knex('dictionary_groups')
        .select('id', 'name')
        .where({ id: aliasRow.entity_id })
        .first();
      return group ? { id: group.id, name: group.name } : null;
    }
    if (entityType === 'artist') {
      const artist = await knex('dictionary_artists')
        .select('id', 'name')
        .where({ id: aliasRow.entity_id })
        .first();
      return artist ? { id: artist.id, name: artist.name } : null;
    }
    if (entityType === 'song') {
      const song = await knex('dictionary_songs')
        .select('id', 'title')
        .where({ id: aliasRow.entity_id })
        .first();
      return song ? { id: song.id, name: song.title } : null;
    }
    const event = await knex('dictionary_events')
      .select('id', 'name')
      .where({ id: aliasRow.entity_id })
      .first();
    return event ? { id: event.id, name: event.name } : null;
  }
}

export const aliasService = new AliasService();
