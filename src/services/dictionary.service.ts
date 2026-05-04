import knex from '../db';

export type DictionaryGroupType = 'male' | 'female' | 'mixed';

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
}

type ImportRecord = Record<string, unknown> & { type?: string };

function toTypes(raw?: string): DictionaryGroupType[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is DictionaryGroupType => ['male', 'female', 'mixed'].includes(x));
}

export class DictionaryService {
  async getGroups(type?: string, q?: string) {
    const types = toTypes(type);
    const query = knex('dictionary_groups as g')
      .select('g.id', 'g.name', 'g.type', 'g.active')
      .count('a.id as artist_count')
      .leftJoin('dictionary_artists as a', 'a.group_id', 'g.id')
      .groupBy('g.id')
      .orderBy('g.name');
    if (types.length) query.whereIn('g.type', types);
    if (q) query.whereILike('g.name', `%${q}%`);
    return query;
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
      .select('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
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

  async getArtists(groupId?: number, q?: string) {
    const query = knex('dictionary_artists as a')
      .select('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .orderBy('a.name');
    if (groupId) query.where('a.group_id', groupId);
    if (q) query.whereILike('a.name', `%${q}%`);
    return query;
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

  async getSongs(q?: string) {
    const query = knex('dictionary_songs').select('id', 'title', 'artist').orderBy('title');
    if (q) query.whereILike('title', `%${q}%`);
    return query;
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

  async getEvents(q?: string) {
    const query = knex('dictionary_events').select('id', 'name').orderBy('name');
    if (q) query.whereILike('name', `%${q}%`);
    return query;
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
