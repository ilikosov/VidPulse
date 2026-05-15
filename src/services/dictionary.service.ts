import knex from '../db';

export type DictionaryGroupType = 'male' | 'female' | 'mixed';

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
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
      .countDistinct('a.id as artist_count')
      .countDistinct('s.id as song_count')
      .countDistinct('v.id as video_count')
      .countDistinct('ga.id as aliases_count')
      .leftJoin('dictionary_artists as a', 'a.group_id', 'g.id')
      .leftJoin('dictionary_songs as s', 's.artist', 'a.name')
      .leftJoin('videos as v', function joinVideosByGroup() {
        this.on('v.group_id', '=', 'g.id').orOn('v.group_name', '=', 'g.name');
      })
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
    const artists = await knex('dictionary_artists')
      .select('id', 'name', 'group_id')
      .where({ group_id: id })
      .orderBy('name');
    return { ...group, artists };
  }

  async getGroupArtists(groupId: number, limit = 20, offset = 0) {
    return knex('dictionary_artists')
      .select('id', 'name', 'group_id')
      .where({ group_id: groupId })
      .orderBy('name')
      .limit(limit)
      .offset(offset);
  }

  async countGroupArtists(groupId: number) {
    const row = await knex('dictionary_artists')
      .where({ group_id: groupId })
      .count('* as count')
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
    return knex('dictionary_artists as a')
      .distinct('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .where('a.id', id)
      .first();
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

  async getVideosByGroupId(groupId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos').where('videos.group_id', groupId);
    const videos = await base
      .clone()
      .leftJoin('dictionary_groups as dg', 'videos.group_id', 'dg.id')
      .leftJoin('dictionary_artists as da', 'videos.artist_id', 'da.id')
      .leftJoin('dictionary_songs as ds', 'videos.song_id', 'ds.id')
      .leftJoin('dictionary_events as de', 'videos.event_id', 'de.id')
      .select(
        'videos.*',
        'dg.name as group_name',
        'da.name as artist_name',
        'ds.title as song_title',
        'de.name as event',
      )
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

  async getVideosByArtistId(artistId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos').where('videos.artist_id', artistId);
    const videos = await base
      .clone()
      .leftJoin('dictionary_groups as dg', 'videos.group_id', 'dg.id')
      .leftJoin('dictionary_artists as da', 'videos.artist_id', 'da.id')
      .leftJoin('dictionary_songs as ds', 'videos.song_id', 'ds.id')
      .leftJoin('dictionary_events as de', 'videos.event_id', 'de.id')
      .select(
        'videos.*',
        'dg.name as group_name',
        'da.name as artist_name',
        'ds.title as song_title',
        'de.name as event',
      )
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

  async getVideosBySongId(songId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos').where('videos.song_id', songId);
    const videos = await base
      .clone()
      .leftJoin('dictionary_groups as dg', 'videos.group_id', 'dg.id')
      .leftJoin('dictionary_artists as da', 'videos.artist_id', 'da.id')
      .leftJoin('dictionary_songs as ds', 'videos.song_id', 'ds.id')
      .leftJoin('dictionary_events as de', 'videos.event_id', 'de.id')
      .select(
        'videos.*',
        'dg.name as group_name',
        'da.name as artist_name',
        'ds.title as song_title',
        'de.name as event',
      )
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

  async getVideosByEventId(eventId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos').where('videos.event_id', eventId);
    const videos = await base
      .clone()
      .leftJoin('dictionary_groups as dg', 'videos.group_id', 'dg.id')
      .leftJoin('dictionary_artists as da', 'videos.artist_id', 'da.id')
      .leftJoin('dictionary_songs as ds', 'videos.song_id', 'ds.id')
      .leftJoin('dictionary_events as de', 'videos.event_id', 'de.id')
      .select(
        'videos.*',
        'dg.name as group_name',
        'da.name as artist_name',
        'ds.title as song_title',
        'de.name as event',
      )
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
      .countDistinct('v.id as videos_count')
      .countDistinct('soa.id as aliases_count')
      .leftJoin('videos as v', function joinVideosBySong() {
        this.on('v.song_id', '=', 's.id').orOn('v.song_title', '=', 's.title');
      });

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
    const [
      groups,
      artists,
      songs,
      events,
      aliases,
      hasGroupId,
      hasArtistId,
      hasSongId,
      hasEventId,
    ] = await Promise.all([
      this.countGroups(),
      this.countArtists(),
      this.countSongs(),
      this.countEvents(),
      knex('dictionary_aliases').count('* as count').first(),
      knex.schema.hasColumn('videos', 'group_id'),
      knex.schema.hasColumn('videos', 'artist_id'),
      knex.schema.hasColumn('videos', 'song_id'),
      knex.schema.hasColumn('videos', 'event_id'),
    ]);

    const [groupLinkedRow, artistLinkedRow, songLinkedRow, eventLinkedRow] = await Promise.all([
      hasGroupId
        ? knex('videos').whereNotNull('group_id').count('* as count').first()
        : knex('videos').whereNotNull('group_name').count('* as count').first(),
      hasArtistId
        ? knex('videos').whereNotNull('artist_id').count('* as count').first()
        : knex('videos').whereNotNull('artist_name').count('* as count').first(),
      hasSongId
        ? knex('videos').whereNotNull('song_id').count('* as count').first()
        : knex('videos').whereNotNull('song_title').count('* as count').first(),
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
