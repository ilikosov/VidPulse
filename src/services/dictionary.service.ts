import knex from '../db';
import { getVideoSongsMap } from './parser/videoSongs.service';

/**
 * Attach the full list of songs (from the `video_songs` junction table, the
 * single source of truth) to each video row.
 */
async function attachSongs<T extends { id: number }>(
  videos: T[],
): Promise<Array<T & { songs: Array<{ id: number | null; title: string }> }>> {
  const songsByVideo = await getVideoSongsMap(videos.map((video) => video.id));
  return videos.map((video) => ({ ...video, songs: songsByVideo.get(video.id) ?? [] }));
}

type MembershipActivityType = 'group' | 'solo';
type MembershipStatus = 'active' | 'former' | 'hiatus';

export type DictionaryGroupType = 'male' | 'female' | 'mixed';

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
}

export interface MediaLibraryImportSummary {
  mode: 'merge' | 'replace';
  groups: { inserted: number; updated: number; aliasesInserted: number };
  artists: {
    inserted: number;
    updated: number;
    aliasesInserted: number;
    membershipsInserted: number;
  };
  songs: {
    inserted: number;
    updated: number;
    aliasesInserted: number;
    artistLinksInserted: number;
    groupLinksInserted: number;
  };
  events: { inserted: number; updated: number; aliasesInserted: number };
  errors: string[];
}
export interface MediaLibraryExportPayload {
  version: 1;
  mode: 'merge';
  exportedAt: string;
  groups: any[];
  soloArtists: any[];
  events: any[];
}

export interface ClearMediaLibrarySummary {
  cleared: {
    groups: number;
    artists: number;
    songs: number;
    events: number;
    aliases: number;
    memberships: number;
    songArtistLinks: number;
    songGroupLinks: number;
  };
  videosUpdated: number;
}
export type AliasEntityType = 'group' | 'artist' | 'song' | 'event';

export interface DictionaryStats {
  groups: number;
  artists: number;
  songs: number;
  events: number;
  aliases: number;
  videosLinkedToGroups: number;
  videosLinkedToArtists: number;
  videosLinkedToSongs: number;
  videosLinkedToEvents: number;
  unmatched: {
    groups: number;
    artists: number;
    songs: number;
    events: number;
  };
}

type ImportRecord = Record<string, unknown> & { type?: string };
type DbClient = typeof knex;

function toTypes(raw?: string): DictionaryGroupType[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is DictionaryGroupType => ['male', 'female', 'mixed'].includes(x));
}

export class DictionaryService {
  private normalizeName(value: string) {
    return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private async addAliasesIfMissing(
    db: DbClient,
    entityType: AliasEntityType,
    entityId: number,
    aliases: unknown,
    canonicalName: string,
  ): Promise<number> {
    if (!Array.isArray(aliases)) return 0;

    let inserted = 0;
    const normalizedCanonical = this.normalizeName(canonicalName);
    for (const rawAlias of aliases) {
      const alias = String(rawAlias ?? '').trim();
      if (!alias) continue;
      if (this.normalizeName(alias) === normalizedCanonical) continue;

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

  private async findGroupByNameOrAlias(trx: DbClient, name: string) {
    const normalized = this.normalizeName(name);
    const byName = await trx('dictionary_groups').whereRaw('LOWER(name) = ?', [normalized]).first();
    if (byName) return byName;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'group' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_groups').where({ id: alias.entity_id }).first();
  }

  private async findArtistByNameOrAlias(trx: DbClient, name: string) {
    const normalized = this.normalizeName(name);
    const byName = await trx('dictionary_artists')
      .whereRaw('LOWER(name) = ?', [normalized])
      .first();
    if (byName) return byName;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'artist' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_artists').where({ id: alias.entity_id }).first();
  }

  private async findSongByTitleOrAlias(trx: DbClient, title: string) {
    const normalized = this.normalizeName(title);
    const byTitle = await trx('dictionary_songs')
      .whereRaw('LOWER(title) = ?', [normalized])
      .first();
    if (byTitle) return byTitle;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'song' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_songs').where({ id: alias.entity_id }).first();
  }

  private async findEventByNameOrAlias(trx: DbClient, name: string) {
    const normalized = this.normalizeName(name);
    const byName = await trx('dictionary_events').whereRaw('LOWER(name) = ?', [normalized]).first();
    if (byName) return byName;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'event' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_events').where({ id: alias.entity_id }).first();
  }

  private async importSongNode(
    db: DbClient,
    songPayload: any,
    context: {
      artist?: { id: number; name: string };
      group?: { id: number; name: string };
    },
    summary: MediaLibraryImportSummary,
  ) {
    const title = String(songPayload.title || '').trim();
    if (!title) return null;

    let song = await this.findSongByTitleOrAlias(db, title);
    if (!song) {
      const [songId] = await db('dictionary_songs').insert({
        title,
        artist: context.artist?.name ?? context.group?.name ?? '',
      });
      song = await db('dictionary_songs').where({ id: songId }).first();
      summary.songs.inserted += 1;
    } else {
      summary.songs.updated += 1;
    }

    if (context.artist) {
      const insertedArtistLink = await db('dictionary_song_artists')
        .insert({ song_id: song.id, artist_id: context.artist.id })
        .onConflict(['song_id', 'artist_id'])
        .ignore();
      if (Array.isArray(insertedArtistLink) && insertedArtistLink.length > 0) {
        summary.songs.artistLinksInserted += 1;
      }
    }

    if (context.group) {
      const insertedGroupLink = await db('dictionary_song_groups')
        .insert({ song_id: song.id, group_id: context.group.id })
        .onConflict(['song_id', 'group_id'])
        .ignore();
      if (Array.isArray(insertedGroupLink) && insertedGroupLink.length > 0) {
        summary.songs.groupLinksInserted += 1;
      }
    }

    summary.songs.aliasesInserted += await this.addAliasesIfMissing(
      db,
      'song',
      song.id,
      songPayload.aliases,
      song.title,
    );

    return song;
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

  private async upsertMembership(payload: {
    artist_id: number;
    group_id: number | null;
    activity_type: MembershipActivityType;
    status: MembershipStatus;
    started_at?: string | null;
    ended_at?: string | null;
    is_primary?: boolean;
  }) {
    const existing = await knex('dictionary_artist_memberships')
      .where({
        artist_id: payload.artist_id,
        group_id: payload.group_id,
        activity_type: payload.activity_type,
        status: payload.status,
      })
      .where((q) => {
        if (payload.started_at) q.where({ started_at: payload.started_at });
        else q.whereNull('started_at');
      })
      .first();

    if (existing) {
      await knex('dictionary_artist_memberships')
        .where({ id: existing.id })
        .update({
          ended_at: payload.ended_at ?? existing.ended_at,
          is_primary: payload.is_primary ?? existing.is_primary,
          updated_at: knex.fn.now(),
        });
      return existing.id;
    }

    const [id] = await knex('dictionary_artist_memberships').insert({
      ...payload,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    return id;
  }

  async getGroups(type?: string, q?: string, limit = 20, offset = 0) {
    const types = toTypes(type);
    const query = knex('dictionary_groups as g')
      .select('g.id', 'g.name', 'g.type', 'g.active')
      .countDistinct('a.id as artist_count')
      .countDistinct('s.id as song_count')
      .countDistinct('v.id as video_count')
      .countDistinct('ga.id as aliases_count')
      .leftJoin('dictionary_artists as a', 'a.group_id', 'g.id')
      .leftJoin('dictionary_songs as s', 's.artist', 'a.name')
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
    const artistsSubQuery = knex('dictionary_artists').select('name').where({ group_id: groupId });
    return knex('dictionary_songs as s')
      .distinct('s.id', 's.title', 's.artist')
      .whereIn('s.artist', artistsSubQuery)
      .orderBy('s.title')
      .limit(limit)
      .offset(offset);
  }

  async countGroupSongs(groupId: number) {
    const artistsSubQuery = knex('dictionary_artists').select('name').where({ group_id: groupId });
    const row = await knex('dictionary_songs as s')
      .whereIn('s.artist', artistsSubQuery)
      .countDistinct('s.id as count')
      .first();
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

  async getSongById(id: number) {
    const song = await knex('dictionary_songs')
      .select('id', 'title', 'artist')
      .where({ id })
      .first();
    if (!song) return null;

    const artists = await knex('dictionary_song_artists as sa')
      .select('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_artists as a', 'a.id', 'sa.artist_id')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .where('sa.song_id', id)
      .orderBy('a.name');

    const groups = await knex('dictionary_song_groups as sg')
      .select('g.id', 'g.name', 'g.type', 'g.active')
      .leftJoin('dictionary_groups as g', 'g.id', 'sg.group_id')
      .where('sg.song_id', id)
      .orderBy('g.name');

    return {
      ...song,
      artist_id: artists[0]?.id,
      artist_name: artists[0]?.name,
      group_id: groups[0]?.id ?? artists[0]?.group_id,
      group_name: groups[0]?.name ?? artists[0]?.group_name,
      artists,
      groups,
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
    // Read from the display view (group_id/artist_id are already columns, so the
    // old text joins to the dictionary are no longer needed — TASK-1 / ADR 0002).
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

  async getVideosByGroupId(groupId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where('videos.group_id', groupId);
    const videos = await base
      .clone()
      // videos_display already exposes display group_name/artist_name/event
      // (COALESCE(dictionary, raw)), so the dictionary name-joins are redundant.
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

  async getVideosByArtistId(artistId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where('videos.artist_id', artistId);
    const videos = await base
      .clone()
      // videos_display already exposes display group_name/artist_name/event
      // (COALESCE(dictionary, raw)), so the dictionary name-joins are redundant.
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

  async getVideosBySongId(songId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    // Match videos that contain this song among possibly several (source of
    // truth is the video_songs junction table, not the denormalized column).
    const base = knex('videos_display as videos').whereIn(
      'videos.id',
      knex('video_songs').select('video_id').where('song_id', songId),
    );
    const videos = await base
      .clone()
      // videos_display already exposes display group_name/artist_name/event
      // (COALESCE(dictionary, raw)), so the dictionary name-joins are redundant.
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

  async getVideosByEventId(eventId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').where('videos.event_id', eventId);
    const videos = await base
      .clone()
      // videos_display already exposes display group_name/artist_name/event
      // (COALESCE(dictionary, raw)), so the dictionary name-joins are redundant.
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
      .select('s.id', 's.title', 's.artist')
      .leftJoin('dictionary_song_artists as sa', 'sa.song_id', 's.id')
      .leftJoin('dictionary_artists as a', 'a.id', 'sa.artist_id')
      .leftJoin('dictionary_song_groups as sg', 'sg.song_id', 's.id')
      .leftJoin('dictionary_groups as g', 'g.id', 'sg.group_id')
      .leftJoin('dictionary_aliases as soa', function joinSongAliasCount() {
        this.on('soa.entity_id', '=', 's.id').andOnVal('soa.entity_type', 'song');
      })
      .groupBy('s.id')
      .orderBy('s.title')
      .select(
        knex.raw('MIN(a.id) as artist_id'),
        knex.raw('MIN(a.name) as artist_name'),
        knex.raw('MIN(g.id) as group_id'),
        knex.raw('MIN(g.name) as group_name'),
      )
      .countDistinct('vs.video_id as videos_count')
      .countDistinct('soa.id as aliases_count')
      .leftJoin('video_songs as vs', 'vs.song_id', 's.id');

    if (q) {
      query.where((builder) => {
        builder.whereILike('s.title', `%${q}%`).orWhereILike('soa.alias', `%${q}%`);
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
  async createSong(payload: {
    title: string;
    artist: string;
    artist_ids?: number[];
    group_ids?: number[];
  }) {
    const [songId] = await knex('dictionary_songs').insert({
      title: payload.title,
      artist: payload.artist,
    });

    if (payload.artist_ids?.length) {
      const links = payload.artist_ids.map((artistId) => ({
        song_id: songId,
        artist_id: artistId,
      }));
      await knex('dictionary_song_artists')
        .insert(links)
        .onConflict(['song_id', 'artist_id'])
        .ignore();
    }
    if (payload.group_ids?.length) {
      const links = payload.group_ids.map((groupId) => ({ song_id: songId, group_id: groupId }));
      await knex('dictionary_song_groups')
        .insert(links)
        .onConflict(['song_id', 'group_id'])
        .ignore();
    }
    return songId;
  }
  async updateSong(
    id: number,
    payload: { title: string; artist: string; artist_ids?: number[]; group_ids?: number[] },
  ) {
    await knex('dictionary_songs')
      .where({ id })
      .update({ title: payload.title, artist: payload.artist });

    if (payload.artist_ids) {
      await knex('dictionary_song_artists').where({ song_id: id }).delete();
      if (payload.artist_ids.length) {
        const links = payload.artist_ids.map((artistId) => ({ song_id: id, artist_id: artistId }));
        await knex('dictionary_song_artists')
          .insert(links)
          .onConflict(['song_id', 'artist_id'])
          .ignore();
      }
    }

    if (payload.group_ids) {
      await knex('dictionary_song_groups').where({ song_id: id }).delete();
      if (payload.group_ids.length) {
        const links = payload.group_ids.map((groupId) => ({ song_id: id, group_id: groupId }));
        await knex('dictionary_song_groups')
          .insert(links)
          .onConflict(['song_id', 'group_id'])
          .ignore();
      }
    }
    return id;
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

  async getStats(): Promise<DictionaryStats> {
    const [groups, artists, songs, events, aliases, hasGroupId, hasArtistId, hasEventId] =
      await Promise.all([
        this.countGroups(),
        this.countArtists(),
        this.countSongs(),
        this.countEvents(),
        knex('dictionary_aliases').count('* as count').first(),
        knex.schema.hasColumn('videos', 'group_id'),
        knex.schema.hasColumn('videos', 'artist_id'),
        knex.schema.hasColumn('videos', 'event_id'),
      ]);

    const [groupLinkedRow, artistLinkedRow, songLinkedRow, eventLinkedRow] = await Promise.all([
      hasGroupId
        ? knex('videos').whereNotNull('group_id').count('* as count').first()
        : knex('videos').whereNotNull('group_name').count('* as count').first(),
      hasArtistId
        ? knex('videos').whereNotNull('artist_id').count('* as count').first()
        : knex('videos').whereNotNull('artist_name').count('* as count').first(),
      // Songs live in video_songs now (TASK-3): count videos with a matched song.
      knex('video_songs').whereNotNull('song_id').countDistinct('video_id as count').first(),
      hasEventId
        ? knex('videos').whereNotNull('event_id').count('* as count').first()
        : knex('videos').whereNotNull('event').count('* as count').first(),
    ]);

    return {
      groups,
      artists,
      songs,
      events,
      aliases: Number(aliases?.count || 0),
      videosLinkedToGroups: Number(groupLinkedRow?.count || 0),
      videosLinkedToArtists: Number(artistLinkedRow?.count || 0),
      videosLinkedToSongs: Number(songLinkedRow?.count || 0),
      videosLinkedToEvents: Number(eventLinkedRow?.count || 0),
      unmatched: {
        groups: Math.max(groups - Number(groupLinkedRow?.count || 0), 0),
        artists: Math.max(artists - Number(artistLinkedRow?.count || 0), 0),
        songs: Math.max(songs - Number(songLinkedRow?.count || 0), 0),
        events: Math.max(events - Number(eventLinkedRow?.count || 0), 0),
      },
    };
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
          const group_id =
            row.group_id == null || row.group_id === '' ? null : Number(row.group_id);
          if (!name) throw new Error('Invalid artist payload');
          let artist = await knex('dictionary_artists').where({ name }).first();
          if (!artist) {
            const [artistId] = await knex('dictionary_artists').insert({ name, group_id });
            artist = { id: artistId, name, group_id };
            summary.inserted += 1;
          } else {
            await knex('dictionary_artists')
              .where({ id: artist.id })
              .update({ name, group_id: group_id ?? artist.group_id });
            summary.updated += 1;
          }

          const activity_type = String(
            row.activity_type || (group_id ? 'group' : 'solo'),
          ).toLowerCase() as MembershipActivityType;
          const status = String(row.status || 'active').toLowerCase() as MembershipStatus;
          const started_at = row.started_at ? String(row.started_at) : null;
          const ended_at = row.ended_at ? String(row.ended_at) : null;
          const is_primary =
            String(row.is_primary ?? (group_id ? 'true' : 'false')).toLowerCase() === 'true';
          await this.upsertMembership({
            artist_id: Number(artist.id),
            group_id,
            activity_type,
            status,
            started_at,
            ended_at,
            is_primary,
          });
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

  async importMediaLibrary(
    payload: unknown,
    options?: {
      onProgress?: (progress: {
        phase:
          | 'queued'
          | 'validating'
          | 'clearing'
          | 'groups'
          | 'artists'
          | 'songs'
          | 'events'
          | 'completed'
          | 'failed';
        processed: number;
        total: number;
        message?: string;
        summary?: Partial<MediaLibraryImportSummary>;
      }) => void;
    },
  ): Promise<MediaLibraryImportSummary> {
    const data = (payload ?? {}) as Record<string, any>;
    const mode = data.mode === 'replace' ? 'replace' : 'merge';
    const summary: MediaLibraryImportSummary = {
      mode,
      groups: { inserted: 0, updated: 0, aliasesInserted: 0 },
      artists: { inserted: 0, updated: 0, aliasesInserted: 0, membershipsInserted: 0 },
      songs: {
        inserted: 0,
        updated: 0,
        aliasesInserted: 0,
        artistLinksInserted: 0,
        groupLinksInserted: 0,
      },
      events: { inserted: 0, updated: 0, aliasesInserted: 0 },
      errors: [],
    };

    const groups = Array.isArray(data.groups) ? data.groups : [];
    const soloArtists = Array.isArray(data.soloArtists) ? data.soloArtists : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const groupArtistsCount = groups.reduce(
      (acc: number, g: any) => acc + (Array.isArray(g.artists) ? g.artists.length : 0),
      0,
    );
    const groupArtistSongsCount = groups.reduce(
      (acc: number, g: any) =>
        acc +
        (Array.isArray(g.artists)
          ? g.artists.reduce(
              (a: number, ar: any) => a + (Array.isArray(ar.songs) ? ar.songs.length : 0),
              0,
            )
          : 0),
      0,
    );
    const groupSongsCount = groups.reduce(
      (acc: number, g: any) => acc + (Array.isArray(g.songs) ? g.songs.length : 0),
      0,
    );
    const soloArtistSongsCount = soloArtists.reduce(
      (acc: number, a: any) => acc + (Array.isArray(a.songs) ? a.songs.length : 0),
      0,
    );
    const total =
      groups.length +
      groupArtistsCount +
      groupArtistSongsCount +
      groupSongsCount +
      soloArtists.length +
      soloArtistSongsCount +
      events.length;
    let processed = 0;
    const emit = (
      phase:
        | 'validating'
        | 'clearing'
        | 'groups'
        | 'artists'
        | 'songs'
        | 'events'
        | 'completed'
        | 'failed',
      message?: string,
    ) => {
      options?.onProgress?.({ phase, processed, total, message, summary });
    };

    emit('validating', 'Validating JSON payload');

    await knex.transaction(async (trx) => {
      for (const groupPayload of groups) {
        const groupName = String(groupPayload.name || '').trim();
        let group = await this.findGroupByNameOrAlias(trx as unknown as DbClient, groupName);
        if (!group) {
          if (!groupPayload.type) throw new Error(`Group "${groupName}" requires type`);
          const [id] = await trx('dictionary_groups').insert({
            name: groupName,
            type: String(groupPayload.type),
            active: groupPayload.active ?? true,
          });
          group = await trx('dictionary_groups').where({ id }).first();
          summary.groups.inserted += 1;
        } else {
          summary.groups.updated += 1;
        }
        summary.groups.aliasesInserted += await this.addAliasesIfMissing(
          trx as unknown as DbClient,
          'group',
          group.id,
          groupPayload.aliases,
          group.name,
        );
        processed += 1;
        emit('groups', `Importing groups: ${groupName}`);

        for (const artistPayload of Array.isArray(groupPayload.artists)
          ? groupPayload.artists
          : []) {
          const artistName = String(artistPayload.name || '').trim();
          let artist = await this.findArtistByNameOrAlias(trx as unknown as DbClient, artistName);
          if (!artist) {
            const [artistId] = await trx('dictionary_artists').insert({
              name: artistName,
              group_id: group.id,
            });
            artist = await trx('dictionary_artists').where({ id: artistId }).first();
            summary.artists.inserted += 1;
          } else summary.artists.updated += 1;
          summary.artists.aliasesInserted += await this.addAliasesIfMissing(
            trx as unknown as DbClient,
            'artist',
            artist.id,
            artistPayload.aliases,
            artist.name,
          );
          await this.addOrUpdateArtistMembership(
            {
              artist_id: artist.id,
              group_id: group.id,
              activity_type: 'group',
              status: (artistPayload.membership?.status || 'active') as MembershipStatus,
              started_at: artistPayload.membership?.from ?? null,
              ended_at: artistPayload.membership?.to ?? null,
              is_primary: artistPayload.membership?.isPrimary ?? false,
            },
            trx as unknown as DbClient,
          );
          summary.artists.membershipsInserted += 1;
          processed += 1;
          emit('artists', `Importing artists: ${artistName}`);

          for (const songPayload of Array.isArray(artistPayload.songs) ? artistPayload.songs : []) {
            await this.importSongNode(
              trx as unknown as DbClient,
              songPayload,
              { artist, group },
              summary,
            );
            processed += 1;
            emit('songs', `Importing songs: ${String(songPayload.title || '').trim()}`);
          }
        }

        for (const songPayload of Array.isArray(groupPayload.songs) ? groupPayload.songs : []) {
          await this.importSongNode(trx as unknown as DbClient, songPayload, { group }, summary);
          processed += 1;
          emit('songs', `Importing songs: ${String(songPayload.title || '').trim()}`);
        }
      }

      for (const soloPayload of soloArtists) {
        const artistName = String(soloPayload.name || '').trim();
        let artist = await this.findArtistByNameOrAlias(trx as unknown as DbClient, artistName);
        if (!artist) {
          const [artistId] = await trx('dictionary_artists').insert({
            name: artistName,
            group_id: null,
          });
          artist = await trx('dictionary_artists').where({ id: artistId }).first();
          summary.artists.inserted += 1;
        } else summary.artists.updated += 1;
        summary.artists.aliasesInserted += await this.addAliasesIfMissing(
          trx as unknown as DbClient,
          'artist',
          artist.id,
          soloPayload.aliases,
          artist.name,
        );
        await this.addOrUpdateArtistMembership(
          {
            artist_id: artist.id,
            group_id: null,
            activity_type: 'solo',
            status: (soloPayload.membership?.status || 'active') as MembershipStatus,
            started_at: soloPayload.membership?.from ?? null,
            ended_at: soloPayload.membership?.to ?? null,
            is_primary: soloPayload.membership?.isPrimary ?? true,
          },
          trx as unknown as DbClient,
        );
        summary.artists.membershipsInserted += 1;
        processed += 1;
        emit('artists', `Importing artists: ${artistName}`);

        for (const songPayload of Array.isArray(soloPayload.songs) ? soloPayload.songs : []) {
          await this.importSongNode(trx as unknown as DbClient, songPayload, { artist }, summary);
          processed += 1;
          emit('songs', `Importing songs: ${String(songPayload.title || '').trim()}`);
        }
      }

      for (const eventPayload of events) {
        const name = String(eventPayload.name || '').trim();
        let event = await this.findEventByNameOrAlias(trx as unknown as DbClient, name);
        if (!event) {
          const [id] = await trx('dictionary_events').insert({ name });
          event = await trx('dictionary_events').where({ id }).first();
          summary.events.inserted += 1;
        } else summary.events.updated += 1;
        summary.events.aliasesInserted += await this.addAliasesIfMissing(
          trx as unknown as DbClient,
          'event',
          event.id,
          eventPayload.aliases,
          event.name,
        );
        processed += 1;
        emit('events', `Importing events: ${name}`);
      }
    });

    emit('completed', 'Completed');
    return summary;
  }

  async exportMediaLibrary(): Promise<MediaLibraryExportPayload> {
    const [groups, artists, songs, events, aliases, memberships, songArtists, songGroups] =
      await Promise.all([
        knex('dictionary_groups').select('*'),
        knex('dictionary_artists').select('*'),
        knex('dictionary_songs').select('*'),
        knex('dictionary_events').select('*'),
        knex('dictionary_aliases').select('*'),
        knex('dictionary_artist_memberships').select('*'),
        knex('dictionary_song_artists').select('*'),
        knex('dictionary_song_groups').select('*'),
      ]);

    const aliasesByEntity = new Map<string, string[]>();
    for (const a of aliases as any[]) {
      const key = `${a.entity_type}:${a.entity_id}`;
      if (!aliasesByEntity.has(key)) aliasesByEntity.set(key, []);
      aliasesByEntity.get(key)!.push(a.alias);
    }

    const artistById = new Map((artists as any[]).map((a) => [a.id, a]));
    const songsById = new Map((songs as any[]).map((s) => [s.id, s]));
    const songArtistSet = new Set((songArtists as any[]).map((r) => `${r.song_id}:${r.artist_id}`));
    const songGroupSet = new Set((songGroups as any[]).map((r) => `${r.song_id}:${r.group_id}`));

    const groupsPayload = (groups as any[]).map((group) => {
      const groupMemberships = (memberships as any[]).filter(
        (m) => m.group_id === group.id && m.activity_type === 'group',
      );

      const artistsPayload = groupMemberships.map((m) => {
        const artist = artistById.get(m.artist_id);
        const artistSongs = (songs as any[])
          .filter(
            (s) =>
              songArtistSet.has(`${s.id}:${artist.id}`) && songGroupSet.has(`${s.id}:${group.id}`),
          )
          .map((s) => ({
            title: s.title,
            aliases: aliasesByEntity.get(`song:${s.id}`) ?? [],
          }));
        return {
          name: artist.name,
          aliases: aliasesByEntity.get(`artist:${artist.id}`) ?? [],
          membership: {
            activityType: m.activity_type,
            status: m.status,
            from: m.started_at ?? null,
            to: m.ended_at ?? null,
            isPrimary: Boolean(m.is_primary),
          },
          songs: artistSongs,
        };
      });

      const artistSongIdsInGroup = new Set<number>();
      for (const s of songs as any[]) {
        if (!songGroupSet.has(`${s.id}:${group.id}`)) continue;
        const hasArtistInGroup = artistsPayload.some((a) => {
          const ar = (artists as any[]).find((x) => x.name === a.name);
          return ar ? songArtistSet.has(`${s.id}:${ar.id}`) : false;
        });
        if (hasArtistInGroup) artistSongIdsInGroup.add(s.id);
      }

      const groupSongs = (songs as any[])
        .filter((s) => songGroupSet.has(`${s.id}:${group.id}`) && !artistSongIdsInGroup.has(s.id))
        .map((s) => ({ title: s.title, aliases: aliasesByEntity.get(`song:${s.id}`) ?? [] }));

      return {
        name: group.name,
        type: group.type,
        active: Boolean(group.active),
        aliases: aliasesByEntity.get(`group:${group.id}`) ?? [],
        artists: artistsPayload,
        songs: groupSongs,
      };
    });

    const soloArtistsPayload = (memberships as any[])
      .filter((m) => m.activity_type === 'solo')
      .map((m) => {
        const artist = artistById.get(m.artist_id);
        const soloSongs = (songs as any[])
          .filter((s) => songArtistSet.has(`${s.id}:${artist.id}`))
          .filter((s) => !(songGroups as any[]).some((sg) => sg.song_id === s.id))
          .map((s) => ({ title: s.title, aliases: aliasesByEntity.get(`song:${s.id}`) ?? [] }));
        return {
          name: artist.name,
          aliases: aliasesByEntity.get(`artist:${artist.id}`) ?? [],
          membership: {
            activityType: 'solo',
            status: m.status,
            from: m.started_at ?? null,
            to: m.ended_at ?? null,
            isPrimary: Boolean(m.is_primary),
          },
          songs: soloSongs,
        };
      });

    const eventsPayload = (events as any[]).map((e) => ({
      name: e.name,
      aliases: aliasesByEntity.get(`event:${e.id}`) ?? [],
    }));

    return {
      version: 1,
      mode: 'merge',
      exportedAt: new Date().toISOString(),
      groups: groupsPayload,
      soloArtists: soloArtistsPayload,
      events: eventsPayload,
    };
  }

  async clearMediaLibrary(): Promise<ClearMediaLibrarySummary> {
    return knex.transaction(async (trx) => {
      const [
        groups,
        artists,
        songs,
        events,
        aliases,
        memberships,
        songArtistLinks,
        songGroupLinks,
      ] = await Promise.all([
        trx('dictionary_groups').count<{ count: number }>('id as count').first(),
        trx('dictionary_artists').count<{ count: number }>('id as count').first(),
        trx('dictionary_songs').count<{ count: number }>('id as count').first(),
        trx('dictionary_events').count<{ count: number }>('id as count').first(),
        trx('dictionary_aliases').count<{ count: number }>('id as count').first(),
        trx('dictionary_artist_memberships').count<{ count: number }>('id as count').first(),
        trx('dictionary_song_artists').count<{ count: number }>('song_id as count').first(),
        trx('dictionary_song_groups').count<{ count: number }>('song_id as count').first(),
      ]);

      // Songs live in video_songs (TASK-3): unlink them from the cleared dictionary.
      await trx('video_songs').update({ song_id: null });
      const videosUpdated = await trx('videos').update({
        group_id: null,
        artist_id: null,
        event_id: null,
        group_name: null,
        artist_name: null,
        event: null,
      });

      await trx('dictionary_aliases').del();
      await trx('dictionary_song_artists').del();
      await trx('dictionary_song_groups').del();
      await trx('dictionary_artist_memberships').del();
      await trx('dictionary_songs').del();
      await trx('dictionary_artists').del();
      await trx('dictionary_events').del();
      await trx('dictionary_groups').del();

      return {
        cleared: {
          groups: Number(groups?.count || 0),
          artists: Number(artists?.count || 0),
          songs: Number(songs?.count || 0),
          events: Number(events?.count || 0),
          aliases: Number(aliases?.count || 0),
          memberships: Number(memberships?.count || 0),
          songArtistLinks: Number(songArtistLinks?.count || 0),
          songGroupLinks: Number(songGroupLinks?.count || 0),
        },
        videosUpdated: Number(videosUpdated || 0),
      };
    });
  }
}

export const dictionaryService = new DictionaryService();
