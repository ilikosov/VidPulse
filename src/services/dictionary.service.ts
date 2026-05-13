import knex from '../db';

export type DictionaryGroupType = 'male' | 'female' | 'mixed';

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
}
export type AliasEntityType = 'group' | 'artist' | 'song';

type ImportRecord = Record<string, unknown> & { type?: string };

function toTypes(raw?: string): DictionaryGroupType[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is DictionaryGroupType => ['male', 'female', 'mixed'].includes(x));
}

export class DictionaryService {
  async getGroups(type?: string, q?: string, limit = 20, offset = 0) {
    const types = toTypes(type);
    const query = knex('dictionary_groups as g')
      .select('g.id', 'g.name', 'g.type', 'g.active')
      .count('a.id as artist_count')
      .leftJoin('dictionary_artists as a', 'a.group_id', 'g.id')
      .groupBy('g.id')
      .orderBy('g.name');
    if (types.length) query.whereIn('g.type', types);
    if (q) {
      query
        .leftJoin('dictionary_aliases as ga', function joinAlias() {
          this.on('ga.entity_id', '=', 'g.id').andOnVal('ga.entity_type', 'group');
        })
        .where((builder) => {
          builder.whereILike('g.name', `%${q}%`).orWhereILike('ga.alias', `%${q}%`);
        });
    }
    return query.limit(limit).offset(offset);
  }
  async getAllGroups(type?: string, q?: string) {
    return this.getGroups(type, q, Number.MAX_SAFE_INTEGER, 0);
  }
  async countGroups(type?: string, q?: string) {
    const types = toTypes(type);
    const query = knex('dictionary_groups as g').countDistinct('g.id as count');
    if (types.length) query.whereIn('g.type', types);
    if (q) {
      query
        .leftJoin('dictionary_aliases as ga', function joinAlias() {
          this.on('ga.entity_id', '=', 'g.id').andOnVal('ga.entity_type', 'group');
        })
        .where((builder) =>
          builder.whereILike('g.name', `%${q}%`).orWhereILike('ga.alias', `%${q}%`),
        );
    }
    const row = await query.first();
    return Number(row?.count || 0);
  }

  async getGroupById(id: number) {
    const group = await knex('dictionary_groups')
      .select('id', 'name', 'type', 'active')
      .where({ id })
      .first();
    if (!group) return null;
    const artists = await knex('dictionary_artists')
      .select('id', 'name', 'group_id')
      .where({ group_id: id })
      .orderBy('name');
    return { ...group, artists };
  }

  async getArtistById(id: number) {
    return knex('dictionary_artists as a')
      .distinct('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .where('a.id', id)
      .first();
  }

  async getSongById(id: number) {
    return knex('dictionary_songs').select('id', 'title', 'artist').where({ id }).first();
  }

  async getVideosByField(
    field: 'group_name' | 'artist_name' | 'song_title',
    value: string,
    page = 1,
    limit = 20,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos').where(field, value);
    const videos = await base
      .clone()
      .leftJoin('dictionary_groups as dg', 'videos.group_name', 'dg.name')
      .leftJoin('dictionary_artists as da', 'videos.artist_name', 'da.name')
      .leftJoin('dictionary_songs as ds', 'videos.song_title', 'ds.title')
      .select('videos.*', 'dg.id as group_id', 'da.id as artist_id', 'ds.id as song_id')
      .orderBy('videos.created_at', 'desc')
      .limit(safeLimit)
      .offset(offset);
    const totalRow = await base.clone().count('* as count').first();
    const total = Number(totalRow?.count || 0);

    return {
      videos,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
  async createGroup(payload: { name: string; type: DictionaryGroupType; active?: boolean }) {
    return knex('dictionary_groups').insert({ ...payload, active: payload.active ?? true });
  }
  async updateGroup(
    id: number,
    payload: { name: string; type: DictionaryGroupType; active?: boolean },
  ) {
    return knex('dictionary_groups').where({ id }).update(payload);
  }
  async deleteGroup(id: number) {
    await knex('dictionary_artists').where({ group_id: id }).delete();
    return knex('dictionary_groups').where({ id }).delete();
  }

  async getArtists(groupId?: number, q?: string, limit = 20, offset = 0) {
    const query = knex('dictionary_artists as a')
      .select('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .orderBy('a.name');
    if (groupId) query.where('a.group_id', groupId);
    if (q) {
      query
        .leftJoin('dictionary_aliases as aa', function joinAlias() {
          this.on('aa.entity_id', '=', 'a.id').andOnVal('aa.entity_type', 'artist');
        })
        .where((builder) => {
          builder.whereILike('a.name', `%${q}%`).orWhereILike('aa.alias', `%${q}%`);
        });
    }
    return query.limit(limit).offset(offset);
  }
  async getAllArtists(groupId?: number, q?: string) {
    return this.getArtists(groupId, q, Number.MAX_SAFE_INTEGER, 0);
  }
  async countArtists(groupId?: number, q?: string) {
    const query = knex('dictionary_artists as a').countDistinct('a.id as count');
    if (groupId) query.where('a.group_id', groupId);
    if (q) {
      query
        .leftJoin('dictionary_aliases as aa', function joinAlias() {
          this.on('aa.entity_id', '=', 'a.id').andOnVal('aa.entity_type', 'artist');
        })
        .where((builder) =>
          builder.whereILike('a.name', `%${q}%`).orWhereILike('aa.alias', `%${q}%`),
        );
    }
    const row = await query.first();
    return Number(row?.count || 0);
  }
  async createArtist(payload: { name: string; group_id: number }) {
    return knex('dictionary_artists').insert(payload);
  }
  async updateArtist(id: number, payload: { name: string; group_id: number }) {
    return knex('dictionary_artists').where({ id }).update(payload);
  }
  async deleteArtist(id: number) {
    return knex('dictionary_artists').where({ id }).delete();
  }

  async getSongs(q?: string, limit = 20, offset = 0) {
    const query = knex('dictionary_songs as s')
      .distinct('s.id', 's.title', 's.artist')
      .orderBy('s.title');
    if (q) {
      query
        .leftJoin('dictionary_aliases as sa', function joinAlias() {
          this.on('sa.entity_id', '=', 's.id').andOnVal('sa.entity_type', 'song');
        })
        .where((builder) => {
          builder.whereILike('s.title', `%${q}%`).orWhereILike('sa.alias', `%${q}%`);
        });
    }
    return query.limit(limit).offset(offset);
  }
  async getAllSongs(q?: string) {
    return this.getSongs(q, Number.MAX_SAFE_INTEGER, 0);
  }
  async countSongs(q?: string) {
    const query = knex('dictionary_songs as s').countDistinct('s.id as count');
    if (q) {
      query
        .leftJoin('dictionary_aliases as sa', function joinAlias() {
          this.on('sa.entity_id', '=', 's.id').andOnVal('sa.entity_type', 'song');
        })
        .where((builder) =>
          builder.whereILike('s.title', `%${q}%`).orWhereILike('sa.alias', `%${q}%`),
        );
    }
    const row = await query.first();
    return Number(row?.count || 0);
  }
  async createSong(payload: { title: string; artist: string }) {
    return knex('dictionary_songs').insert(payload);
  }
  async updateSong(id: number, payload: { title: string; artist: string }) {
    return knex('dictionary_songs').where({ id }).update(payload);
  }
  async deleteSong(id: number) {
    return knex('dictionary_songs').where({ id }).delete();
  }

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
    const song = await knex('dictionary_songs')
      .select('id', 'title')
      .where({ id: aliasRow.entity_id })
      .first();
    return song ? { id: song.id, name: song.title } : null;
  }

  async getEvents(q?: string, limit = 20, offset = 0) {
    const query = knex('dictionary_events').select('id', 'name').orderBy('name');
    if (q) query.whereILike('name', `%${q}%`);
    return query.limit(limit).offset(offset);
  }
  async getAllEvents(q?: string) {
    return this.getEvents(q, Number.MAX_SAFE_INTEGER, 0);
  }
  async countEvents(q?: string) {
    const query = knex('dictionary_events').count('* as count');
    if (q) query.whereILike('name', `%${q}%`);
    const row = await query.first();
    return Number(row?.count || 0);
  }
  async createEvent(payload: { name: string }) {
    return knex('dictionary_events').insert(payload);
  }
  async updateEvent(id: number, payload: { name: string }) {
    return knex('dictionary_events').where({ id }).update(payload);
  }
  async deleteEvent(id: number) {
    return knex('dictionary_events').where({ id }).delete();
  }

  async getAllSettings() {
    const rows = await knex('settings').select('key', 'value');
    return rows.reduce<Record<string, string>>((acc, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async upsertSetting(key: string, value: string) {
    await knex('settings').insert({ key, value }).onConflict('key').merge({ value });
  }

  async importRecords(records: ImportRecord[]): Promise<ImportSummary> {
    const summary: ImportSummary = { total: records.length, inserted: 0, updated: 0, errors: [] };
    for (const [index, row] of records.entries()) {
      try {
        const kind = String(row.type || '').toLowerCase();
        if (kind === 'groups') {
          const name = String(row.name || '').trim();
          const type = String(
            row.group_type ||
              row.type_value ||
              row.groupType ||
              row['type_group'] ||
              row['groupType'] ||
              row['type_name'] ||
              row['group_type'] ||
              row['category'] ||
              row['subtype'] ||
              row['type2'] ||
              row['groupTypeValue'] ||
              row['group_type_value'] ||
              row['group-type'] ||
              row['typeLabel'] ||
              row['type'] ||
              '',
          ).trim();
          const active =
            row.active === undefined
              ? true
              : String(row.active) !== '0' && String(row.active).toLowerCase() !== 'false';
          if (!name || !['male', 'female', 'mixed'].includes(type))
            throw new Error('Invalid group payload');
          const existing = await knex('dictionary_groups').where({ name }).first();
          if (existing) {
            await knex('dictionary_groups').where({ id: existing.id }).update({ type, active });
            summary.updated += 1;
          } else {
            await knex('dictionary_groups').insert({ name, type, active });
            summary.inserted += 1;
          }
        } else if (kind === 'artists') {
          const name = String(row.name || '').trim();
          const group_id = Number(row.group_id);
          if (!name || !group_id) throw new Error('Invalid artist payload');
          const existing = await knex('dictionary_artists').where({ name, group_id }).first();
          if (existing) {
            await knex('dictionary_artists').where({ id: existing.id }).update({ name, group_id });
            summary.updated += 1;
          } else {
            await knex('dictionary_artists').insert({ name, group_id });
            summary.inserted += 1;
          }
        } else if (kind === 'songs') {
          const title = String(row.title || '').trim();
          const artist = String(row.artist || '').trim();
          if (!title || !artist) throw new Error('Invalid song payload');
          const existing = await knex('dictionary_songs').where({ title, artist }).first();
          if (existing) {
            await knex('dictionary_songs').where({ id: existing.id }).update({ title, artist });
            summary.updated += 1;
          } else {
            await knex('dictionary_songs').insert({ title, artist });
            summary.inserted += 1;
          }
        } else if (kind === 'aliases') {
          const entityType = String(row.entity_type || '')
            .trim()
            .toLowerCase() as AliasEntityType;
          const entityName = String(row.entity_name || '').trim();
          const alias = String(row.alias || '').trim();
          const normalizedAlias = alias.toLowerCase();
          if (!['group', 'artist', 'song'].includes(entityType) || !entityName || !alias) {
            throw new Error('Invalid alias payload');
          }

          let entityId: number | null = null;
          if (entityType === 'group') {
            const group = await knex('dictionary_groups')
              .whereRaw('LOWER(name) = ?', [entityName.toLowerCase()])
              .first();
            entityId = group?.id ?? null;
          } else if (entityType === 'artist') {
            const artist = await knex('dictionary_artists')
              .whereRaw('LOWER(name) = ?', [entityName.toLowerCase()])
              .first();
            entityId = artist?.id ?? null;
          } else {
            const song = await knex('dictionary_songs')
              .whereRaw('LOWER(title) = ?', [entityName.toLowerCase()])
              .first();
            entityId = song?.id ?? null;
          }

          if (!entityId) {
            throw new Error('Alias entity not found');
          }

          const existingAlias = await knex('dictionary_aliases')
            .where({ entity_type: entityType, entity_id: entityId })
            .andWhereRaw('LOWER(alias) = ?', [normalizedAlias])
            .first();
          if (existingAlias) {
            summary.updated += 1;
          } else {
            await knex('dictionary_aliases').insert({
              entity_type: entityType,
              entity_id: entityId,
              alias,
            });
            summary.inserted += 1;
          }
        } else if (kind === 'events') {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('Invalid event payload');
          const existing = await knex('dictionary_events').where({ name }).first();
          if (existing) {
            summary.updated += 1;
          } else {
            await knex('dictionary_events').insert({ name });
            summary.inserted += 1;
          }
        } else throw new Error('Unknown type');
      } catch (e) {
        summary.errors.push(`row ${index + 1}: ${(e as Error).message}`);
      }
    }
    return summary;
  }
}

export const dictionaryService = new DictionaryService();
