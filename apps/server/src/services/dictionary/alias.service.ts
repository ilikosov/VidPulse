import { knex } from '@vidpulse/db';
import type { AliasEntityType } from './utils';

export class AliasService {
  async getAliases(entityType: AliasEntityType, entityId: number) {
    return knex('dictionary_aliases')
      .select('id', 'alias')
      .where({ entity_type: entityType, entity_id: entityId })
      .orderBy('alias');
  }

  async addAlias(entityType: AliasEntityType, entityId: number, alias: string) {
    const trimmedAlias = alias.trim();
    const [id] = await knex('dictionary_aliases').insert({
      entity_type: entityType,
      entity_id: entityId,
      alias: trimmedAlias,
    });
    return knex('dictionary_aliases').select('id', 'alias').where({ id }).first();
  }

  async removeAlias(entityType: AliasEntityType, entityId: number, aliasId: number) {
    return knex('dictionary_aliases')
      .where({ id: aliasId, entity_type: entityType, entity_id: entityId })
      .delete();
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
