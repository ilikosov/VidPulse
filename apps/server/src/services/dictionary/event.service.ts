import knex from '../../db';
import type Knex from 'knex';
import { type DbClient, normalizeName, attachSongs } from './utils';

export class EventService {
  async findEventByNameOrAlias(trx: DbClient, name: string) {
    const normalized = normalizeName(name);
    const byName = await trx('dictionary_events').whereRaw('LOWER(name) = ?', [normalized]).first();
    if (byName) return byName;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'event' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_events').where({ id: alias.entity_id }).first();
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

  async getVideosByEventId(eventId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where('videos.event_id', eventId);
    const videos = await base
      .clone()
      .select('videos.*')
      .orderBy('videos.created_at', 'desc')
      .limit(safeLimit)
      .offset(offset);
    const totalRow = await base.clone().count('* as count').first();
    const total = Number(totalRow?.count || 0);
    return {
      videos: await attachSongs(videos),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}

export const eventService = new EventService();
