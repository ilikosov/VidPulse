import knex from '../db';

export type DictionaryGroupType = 'male' | 'female' | 'mixed';

function toTypes(raw?: string): DictionaryGroupType[] {
  if (!raw) return [];
  return raw.split(',').map((x) => x.trim()).filter((x): x is DictionaryGroupType => ['male', 'female', 'mixed'].includes(x));
}

export class DictionaryService {
  async getGroups(type?: string, q?: string) {
    const types = toTypes(type);
    const query = knex('dictionary_groups').select('id', 'name', 'type').where('active', 1).orderBy('name');
    if (types.length) query.whereIn('type', types);
    if (q) query.whereILike('name', `%${q}%`);
    return query.limit(50);
  }

  async getArtists(groupId?: number, q?: string) {
    const query = knex('dictionary_artists as a').select('a.id', 'a.name', 'a.group_id', 'g.name as group_name').leftJoin('dictionary_groups as g', 'g.id', 'a.group_id').orderBy('a.name');
    if (groupId) query.where('a.group_id', groupId);
    if (q) query.whereILike('a.name', `%${q}%`);
    return query.limit(50);
  }

  async getSongs(q?: string) {
    const query = knex('dictionary_songs').select('id', 'title', 'artist').orderBy('title');
    if (q) query.whereILike('title', `%${q}%`);
    return query.limit(50);
  }

  async getEvents(q?: string) {
    const query = knex('dictionary_events').select('id', 'name').orderBy('name');
    if (q) query.whereILike('name', `%${q}%`);
    return query.limit(50);
  }

  async getAllSettings() {
    const rows = await knex('settings').select('key', 'value');
    return rows.reduce<Record<string, string>>((acc, row) => { acc[row.key] = row.value; return acc; }, {});
  }

  async upsertSetting(key: string, value: string) {
    await knex('settings').insert({ key, value }).onConflict('key').merge({ value });
  }
}

export const dictionaryService = new DictionaryService();
