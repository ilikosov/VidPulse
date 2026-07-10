import { knex } from '@vidpulse/db';
import type Knex from 'knex';
import { config } from '../../config';
import {
  type DbClient,
  type DictionaryGroupType,
  normalizeName,
  toTypes,
  attachSongs,
  primaryAliasSelect,
} from './utils';

export class GroupService {
  async findGroupByNameOrAlias(trx: DbClient, name: string) {
    const normalized = normalizeName(name);
    const byName = await trx('dictionary_groups').whereRaw('LOWER(name) = ?', [normalized]).first();
    if (byName) return byName;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'group' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_groups').where({ id: alias.entity_id }).first();
  }

  async getGroups(type?: string, q?: string, limit = 20, offset = 0) {
    const types = toTypes(type);
    const query = knex('dictionary_groups as g')
      .select('g.id', 'g.name', 'g.type', 'g.active')
      .select(primaryAliasSelect('group', 'g.id'))
      .countDistinct('a.id as artist_count')
      .countDistinct('s.id as song_count')
      .countDistinct('v.id as video_count')
      .countDistinct('ga.id as aliases_count')
      .leftJoin('dictionary_artists as a', 'a.group_id', 'g.id')
      .leftJoin('dictionary_song_groups as sg', 'sg.group_id', 'g.id')
      .leftJoin('dictionary_songs as s', 's.id', 'sg.song_id')
      .leftJoin('videos as v', 'v.group_id', 'g.id')
      .leftJoin('dictionary_aliases as ga', function joinAliasCount() {
        this.on('ga.entity_id', '=', 'g.id').andOnVal('ga.entity_type', 'group');
      })
      .groupBy('g.id')
      .orderBy('g.name');
    if (types.length) query.whereIn('g.type', types);
    if (q) {
      query.where((builder) => {
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
      .select(primaryAliasSelect('group', 'dictionary_groups.id'))
      .where({ id })
      .first();
    if (!group) return null;
    const artists = await knex('dictionary_artist_memberships as m')
      .select(
        'a.id',
        'a.name',
        'a.group_id',
        'm.activity_type',
        'm.status',
        'm.started_at',
        'm.ended_at',
        'm.is_primary',
      )
      .leftJoin('dictionary_artists as a', 'a.id', 'm.artist_id')
      .where('m.group_id', id)
      .orderBy('a.name');
    return { ...group, artists };
  }

  async getGroupArtists(groupId: number, limit = 20, offset = 0) {
    return knex('dictionary_artist_memberships as m')
      .select(
        'a.id',
        'a.name',
        'a.group_id',
        'm.activity_type',
        'm.status',
        'm.started_at',
        'm.ended_at',
        'm.is_primary',
      )
      .leftJoin('dictionary_artists as a', 'a.id', 'm.artist_id')
      .where('m.group_id', groupId)
      .orderBy('a.name')
      .limit(limit)
      .offset(offset);
  }

  async countGroupArtists(groupId: number) {
    const row = await knex('dictionary_artist_memberships')
      .where({ group_id: groupId })
      .countDistinct('artist_id as count')
      .first();
    return Number(row?.count || 0);
  }

  async getGroupSongs(groupId: number, limit = 20, offset = 0) {
    // Songs belong to a group via the dictionary_song_groups link table (the canonical
    // link the importer/seed write). Matching on the denormalized dictionary_songs.artist
    // text missed group-level songs whose artist is the group name, not a member name.
    return knex('dictionary_songs as s')
      .distinct('s.id', 's.title', 's.artist')
      .join('dictionary_song_groups as sg', 'sg.song_id', 's.id')
      .where('sg.group_id', groupId)
      .orderBy('s.title')
      .limit(limit)
      .offset(offset);
  }

  async countGroupSongs(groupId: number) {
    const row = await knex('dictionary_songs as s')
      .join('dictionary_song_groups as sg', 'sg.song_id', 's.id')
      .where('sg.group_id', groupId)
      .countDistinct('s.id as count')
      .first();
    return Number(row?.count || 0);
  }

  async getVideosByGroupId(groupId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where('videos.group_id', groupId);
    if (config.hideFlaggedVideos) {
      base.whereNotIn('videos.id', function () {
        this.select('v2.id')
          .from('videos as v2')
          .join('video_tags as vt2', 'vt2.video_id', 'v2.id')
          .join('tags as t2', 't2.id', 'vt2.tag_id')
          .whereIn('t2.name', ['shorts', 'private']);
      });
    }
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
}

export const groupService = new GroupService();
