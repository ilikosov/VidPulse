import knex from '../../db';
import type Knex from 'knex';
import {
  type DbClient,
  type MembershipActivityType,
  type MembershipStatus,
  normalizeName,
  attachSongs,
} from './utils';

export class ArtistService {
  async findArtistByNameOrAlias(trx: DbClient, name: string) {
    const normalized = normalizeName(name);

    // Fast path: SQL LOWER() matches the JS-normalized name (true for clean ASCII names).
    const byName = await trx('dictionary_artists')
      .whereRaw('LOWER(name) = ?', [normalized])
      .first();
    if (byName) return byName;

    // Robust path: SQLite LOWER() only folds ASCII and keeps irregular whitespace, so it
    // disagrees with normalizeName() (NFKC + collapsed whitespace + Unicode lowercasing).
    // Re-check candidates in JS so e.g. "RED  VELVET" and "RED VELVET" dedupe correctly.
    const byNormalizedName = (await trx('dictionary_artists').select('id', 'name')).find(
      (a) => normalizeName(a.name) === normalized,
    );
    if (byNormalizedName) {
      return trx('dictionary_artists').where({ id: byNormalizedName.id }).first();
    }

    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'artist' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (alias) return trx('dictionary_artists').where({ id: alias.entity_id }).first();

    const byNormalizedAlias = (
      await trx('dictionary_aliases').where({ entity_type: 'artist' }).select('alias', 'entity_id')
    ).find((a) => normalizeName(a.alias) === normalized);
    if (!byNormalizedAlias) return null;
    return trx('dictionary_artists').where({ id: byNormalizedAlias.entity_id }).first();
  }

  async getArtistMemberships(artistId: number) {
    return knex('dictionary_artist_memberships as m')
      .leftJoin('dictionary_groups as g', 'g.id', 'm.group_id')
      .select(
        'm.id',
        'm.artist_id',
        'm.group_id',
        'g.name as group_name',
        'm.activity_type',
        'm.status',
        'm.started_at',
        'm.ended_at',
        'm.is_primary',
        'm.created_at',
        'm.updated_at',
      )
      .where('m.artist_id', artistId)
      .orderBy([
        { column: 'm.is_primary', order: 'desc' },
        { column: 'm.created_at', order: 'desc' },
      ]);
  }

  async findActiveMemberships(artistId: number) {
    return knex('dictionary_artist_memberships')
      .where({ artist_id: artistId, status: 'active' })
      .orderBy([
        { column: 'is_primary', order: 'desc' },
        { column: 'created_at', order: 'desc' },
      ]);
  }

  async getGroupArtistsByMembership(groupId: number, status?: MembershipStatus) {
    const query = knex('dictionary_artist_memberships as m')
      .leftJoin('dictionary_artists as a', 'a.id', 'm.artist_id')
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
      .where('m.group_id', groupId)
      .andWhere('m.activity_type', 'group')
      .orderBy([
        { column: 'm.is_primary', order: 'desc' },
        { column: 'a.name', order: 'asc' },
      ]);

    if (status) query.andWhere('m.status', status);
    return query;
  }

  async addOrUpdateArtistMembership(
    payload: {
      artist_id: number;
      group_id: number | null;
      activity_type: MembershipActivityType;
      status: MembershipStatus;
      started_at?: string | null;
      ended_at?: string | null;
      is_primary?: boolean;
    },
    db: typeof knex = knex,
  ) {
    const startedAt = payload.started_at ?? null;

    const query = db('dictionary_artist_memberships')
      .where({
        artist_id: payload.artist_id,
        activity_type: payload.activity_type,
        status: payload.status,
      })
      .where((qb) => {
        if (payload.activity_type === 'group') {
          qb.where({ group_id: payload.group_id });
        } else {
          qb.whereNull('group_id');
        }
      })
      .where((qb) => {
        if (startedAt) qb.where({ started_at: startedAt });
        else qb.whereNull('started_at');
      });

    const existing = await query.first();
    if (existing) {
      await db('dictionary_artist_memberships')
        .where({ id: existing.id })
        .update({
          ended_at: payload.ended_at ?? existing.ended_at,
          is_primary: payload.is_primary ?? existing.is_primary,
          updated_at: db.fn.now(),
        });
      return existing.id as number;
    }

    const [id] = await db('dictionary_artist_memberships').insert({
      ...payload,
      started_at: startedAt,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    return Number(id);
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

  async getArtistById(id: number) {
    const artist = await knex('dictionary_artists as a')
      .distinct('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .where('a.id', id)
      .first();
    if (!artist) return null;
    const memberships = await knex('dictionary_artist_memberships as m')
      .leftJoin('dictionary_groups as g', 'g.id', 'm.group_id')
      .select(
        'm.id',
        'm.group_id',
        'g.name as group_name',
        'm.activity_type',
        'm.status',
        'm.started_at',
        'm.ended_at',
        'm.is_primary',
      )
      .where('m.artist_id', id)
      .orderBy('m.is_primary', 'desc');
    return { ...artist, memberships };
  }

  async getArtistSongs(artistId: number, limit = 20, offset = 0) {
    const artist = await this.getArtistById(artistId);
    if (!artist?.name) return [];
    return knex('dictionary_songs as s')
      .distinct('s.id', 's.title', 's.artist')
      .where('s.artist', artist.name)
      .orderBy('s.title')
      .limit(limit)
      .offset(offset);
  }

  async countArtistSongs(artistId: number) {
    const artist = await this.getArtistById(artistId);
    if (!artist?.name) return 0;
    const row = await knex('dictionary_songs as s')
      .where('s.artist', artist.name)
      .countDistinct('s.id as count')
      .first();
    return Number(row?.count || 0);
  }

  async getVideosByArtistId(artistId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where('videos.artist_id', artistId);
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

  async getVideosByField(
    field: 'group_name' | 'artist_name' | 'song_title',
    value: string,
    page = 1,
    limit = 20,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where(`videos.${field}`, value);
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

  async createArtist(payload: { name: string; group_id: number }) {
    return knex('dictionary_artists').insert(payload);
  }

  async updateArtist(id: number, payload: { name: string; group_id: number }) {
    return knex('dictionary_artists').where({ id }).update(payload);
  }

  async deleteArtist(id: number) {
    return knex('dictionary_artists').where({ id }).delete();
  }
}

export const artistService = new ArtistService();
