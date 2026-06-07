import knex from '../db';
import { config } from '../config';
import type {
  IChannelRepository,
  IPlaylistRepository,
  IVideoRepository,
  ITagRepository,
  IDictionaryGroupRepository,
  IDictionaryArtistRepository,
  IDictionarySongRepository,
  IDictionaryEventRepository,
  IDictionaryAliasRepository,
  ISettingsRepository,
  IVideoListRepository,
  IEventLogRepository,
  IDuplicateGroupRepository,
  ChannelEntity,
  PlaylistEntity,
  VideoEntity,
  VideoInsertData,
  VideoSongEntity,
  TagEntity,
  DictionaryGroupEntity,
  DictionaryArtistEntity,
  DictionarySongEntity,
  DictionaryEventEntity,
  DictionaryAliasEntity,
  ArtistMembershipEntity,
  VideoListEntity,
  EventLogEntity,
  SettingsEntity,
  DuplicateGroupEntity,
  IVideoFilters,
} from '../interfaces/repositories';

const PROTECTED_TAGS = new Set(['shorts', 'long_video', 'private']);

function singleResult<T>(result: T | T[]): T {
  return Array.isArray(result) ? result[0] : result;
}

// ── Channel ───────────────────────────────────────────────

export class KnexChannelRepository implements IChannelRepository {
  async getAll(): Promise<ChannelEntity[]> {
    return knex('channels').select('*');
  }

  async findAllPaginated(limit: number, offset: number): Promise<ChannelEntity[]> {
    return knex('channels')
      .select(
        'id',
        'youtube_id',
        'title',
        'thumbnail_url',
        'is_favorite',
        'added_at',
        'last_checked_at',
      )
      .orderBy('added_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  async count(): Promise<number> {
    const result = await knex('channels').count<{ count: number }[]>('* as count').first();
    return result?.count ?? 0;
  }

  async updateLastCheckedAt(id: number, isoDate: string): Promise<void> {
    await knex('channels').where('id', id).update({ last_checked_at: isoDate });
  }

  async findByYoutubeId(youtubeId: string): Promise<ChannelEntity | null> {
    return (await knex('channels').where('youtube_id', youtubeId).first()) ?? null;
  }

  async findById(id: number): Promise<ChannelEntity | null> {
    return (await knex('channels').where('id', id).first()) ?? null;
  }

  async insert(data: Partial<ChannelEntity>): Promise<number> {
    const result = await knex('channels').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async delete(id: number): Promise<void> {
    await knex('channels').where('id', id).delete();
  }
}

// ── Playlist ──────────────────────────────────────────────

export class KnexPlaylistRepository implements IPlaylistRepository {
  async getAll(): Promise<PlaylistEntity[]> {
    return knex('playlists').select('*');
  }

  async findAllPaginated(limit: number, offset: number): Promise<PlaylistEntity[]> {
    return knex('playlists')
      .select('id', 'youtube_id', 'title', 'added_at', 'last_checked_at')
      .orderBy('added_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  async count(): Promise<number> {
    const result = await knex('playlists').count<{ count: number }[]>('* as count').first();
    return result?.count ?? 0;
  }

  async updateLastCheckedAt(id: number, isoDate: string): Promise<void> {
    await knex('playlists').where('id', id).update({ last_checked_at: isoDate });
  }

  async findByYoutubeId(youtubeId: string): Promise<PlaylistEntity | null> {
    return (await knex('playlists').where('youtube_id', youtubeId).first()) ?? null;
  }

  async findById(id: number): Promise<PlaylistEntity | null> {
    return (await knex('playlists').where('id', id).first()) ?? null;
  }

  async insert(data: Partial<PlaylistEntity>): Promise<number> {
    const result = await knex('playlists').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async delete(id: number): Promise<void> {
    await knex('playlists').where('id', id).delete();
  }
}

// ── Video ─────────────────────────────────────────────────

export class KnexVideoRepository implements IVideoRepository {
  async findByYoutubeId(youtubeId: string): Promise<VideoEntity | null> {
    return (await knex('videos').where('youtube_id', youtubeId).first()) ?? null;
  }

  async findYoutubeIdsByPlaylistId(playlistId: number): Promise<Set<string>> {
    const rows = await knex('videos').where('playlist_id', playlistId).select('youtube_id');
    return new Set(rows.map((r: { youtube_id: string }) => r.youtube_id));
  }

  async insert(data: VideoInsertData): Promise<number> {
    const result = await knex('videos').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async findById(id: number): Promise<VideoEntity | null> {
    return (await knex('videos').where('id', id).first()) ?? null;
  }

  async findAll(
    filters: IVideoFilters,
    pagination: { limit: number; offset: number },
  ): Promise<VideoEntity[]> {
    const query = knex('videos');
    this.applyFilters(query, filters);
    return query.limit(pagination.limit).offset(pagination.offset).orderBy('created_at', 'desc');
  }

  async countAll(filters: IVideoFilters): Promise<number> {
    const query = knex('videos');
    this.applyFilters(query, filters);
    const result = await query.count<{ count: number }[]>('* as count').first();
    return result?.count ?? 0;
  }

  async update(id: number, data: Partial<VideoEntity>): Promise<void> {
    await knex('videos').where('id', id).update(data);
  }

  async updateMultiple(ids: number[], data: Partial<VideoEntity>): Promise<void> {
    await knex('videos').whereIn('id', ids).update(data);
  }

  async delete(id: number): Promise<void> {
    await knex('videos').where('id', id).delete();
  }

  async findAllDisplay(
    filters: IVideoFilters,
    pagination: { limit: number; offset: number },
  ): Promise<VideoEntity[]> {
    const query = knex('videos_display as videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select('videos.*', 'channels.title as channel_title', 'playlists.title as playlist_title');
    this.applyFilters(query, filters);
    return query
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy('videos.created_at', 'desc');
  }

  async findByIdDisplay(id: number): Promise<VideoEntity | null> {
    const row = await knex('videos_display as videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select('videos.*', 'channels.title as channel_title', 'playlists.title as playlist_title')
      .where('videos.id', id)
      .first();
    return row ?? null;
  }

  private applyFilters(query: ReturnType<typeof knex>, filters: IVideoFilters): void {
    const { status, includeIgnored, channelId } = filters;
    if (channelId) query.where('videos.channel_id', channelId);
    if (status) query.where('videos.status', status);
    else if (!includeIgnored) query.whereNot('videos.status', 'ignored');
    if (config.hideFlaggedVideos) {
      query.whereNotIn('videos.id', function () {
        this.select('v2.id')
          .from('videos as v2')
          .join('video_tags as vt', 'vt.video_id', 'v2.id')
          .join('tags as t', 't.id', 'vt.tag_id')
          .whereIn('t.name', ['shorts', 'private']);
      });
    }
  }
}

// ── Tag ───────────────────────────────────────────────────

export class KnexTagRepository implements ITagRepository {
  async findOrCreate(name: string): Promise<number> {
    const existing = await knex('tags').whereRaw('LOWER(name) = LOWER(?)', [name]).first();
    if (existing) return existing.id;
    const result = await knex('tags').insert({ name }).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async findByName(name: string): Promise<TagEntity | null> {
    return (await knex('tags').whereRaw('LOWER(name) = LOWER(?)', [name]).first()) ?? null;
  }

  async findAll(): Promise<TagEntity[]> {
    return knex('tags').select('*');
  }

  async getVideoTags(videoId: number): Promise<Array<{ id: number; name: string }>> {
    return knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('tags.id', 'tags.name')
      .where('video_tags.video_id', videoId)
      .orderBy('tags.name', 'asc');
  }

  async getVideosTagsMap(
    videoIds: number[],
  ): Promise<Map<number, Array<{ id: number; name: string }>>> {
    if (videoIds.length === 0) return new Map();
    const rows = await knex('video_tags')
      .join('tags', 'video_tags.tag_id', 'tags.id')
      .select('video_tags.video_id', 'tags.id', 'tags.name')
      .whereIn('video_tags.video_id', videoIds)
      .orderBy('tags.name', 'asc');
    const map = new Map<number, Array<{ id: number; name: string }>>();
    for (const row of rows) {
      const tags = map.get(row.video_id) ?? [];
      tags.push({ id: row.id, name: row.name });
      map.set(row.video_id, tags);
    }
    return map;
  }

  async addVideoTag(videoId: number, tagId: number): Promise<void> {
    await knex('video_tags')
      .insert({ video_id: videoId, tag_id: tagId })
      .onConflict(['video_id', 'tag_id'])
      .ignore();
  }

  async removeVideoTag(videoId: number, tagId: number): Promise<void> {
    await knex('video_tags').where({ video_id: videoId, tag_id: tagId }).delete();
  }

  async batchAddTags(videoIds: number[], tagId: number): Promise<number> {
    const records = videoIds.map((videoId) => ({ video_id: videoId, tag_id: tagId }));
    let added = 0;
    for (const record of records) {
      await knex('video_tags').insert(record).onConflict(['video_id', 'tag_id']).ignore();
      added++;
    }
    return added;
  }

  async batchRemoveTags(videoIds: number[], tagId: number): Promise<number> {
    return knex('video_tags').whereIn('video_id', videoIds).where('tag_id', tagId).delete();
  }

  isProtected(name: string): boolean {
    return PROTECTED_TAGS.has(name.trim().toLowerCase());
  }

  getProtectedNames(): string[] {
    return Array.from(PROTECTED_TAGS);
  }
}

// ── Dictionary: Groups ────────────────────────────────────

export class KnexDictionaryGroupRepository implements IDictionaryGroupRepository {
  async findAll(
    type?: string,
    q?: string,
    limit?: number,
    offset?: number,
  ): Promise<DictionaryGroupEntity[]> {
    const query = knex('dictionary_groups').select('*');
    if (type) query.where('type', type);
    if (q) query.where('name', 'like', `%${q}%`);
    if (limit != null) query.limit(limit);
    if (offset != null) query.offset(offset);
    return query.orderBy('name', 'asc');
  }

  async getAll(type?: string, q?: string): Promise<DictionaryGroupEntity[]> {
    const query = knex('dictionary_groups').select('*');
    if (type) query.where('type', type);
    if (q) query.where('name', 'like', `%${q}%`);
    return query.orderBy('name', 'asc');
  }

  async count(type?: string, q?: string): Promise<number> {
    const query = knex('dictionary_groups').count<{ count: number }[]>('* as count').first();
    if (type) (query as any).where('type', type);
    if (q) (query as any).where('name', 'like', `%${q}%`);
    const result = await query;
    return result?.count ?? 0;
  }

  async findById(id: number): Promise<DictionaryGroupEntity | null> {
    return (await knex('dictionary_groups').where('id', id).first()) ?? null;
  }

  async findByName(name: string): Promise<DictionaryGroupEntity | null> {
    return (await knex('dictionary_groups').where('name', name).first()) ?? null;
  }

  async create(data: Pick<DictionaryGroupEntity, 'name' | 'type'>): Promise<number> {
    const result = await knex('dictionary_groups').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async update(id: number, data: Partial<DictionaryGroupEntity>): Promise<void> {
    await knex('dictionary_groups').where('id', id).update(data);
  }

  async delete(id: number): Promise<void> {
    await knex('dictionary_groups').where('id', id).delete();
  }
}

// ── Dictionary: Artists ──────────────────────────────────

export class KnexDictionaryArtistRepository implements IDictionaryArtistRepository {
  async findAll(
    groupId?: number,
    q?: string,
    limit?: number,
    offset?: number,
  ): Promise<DictionaryArtistEntity[]> {
    const query = knex('dictionary_artists').select('*');
    if (groupId) query.where('group_id', groupId);
    if (q) query.where('name', 'like', `%${q}%`);
    if (limit != null) query.limit(limit);
    if (offset != null) query.offset(offset);
    return query.orderBy('name', 'asc');
  }

  async getAll(groupId?: number, q?: string): Promise<DictionaryArtistEntity[]> {
    const query = knex('dictionary_artists').select('*');
    if (groupId) query.where('group_id', groupId);
    if (q) query.where('name', 'like', `%${q}%`);
    return query.orderBy('name', 'asc');
  }

  async count(groupId?: number, q?: string): Promise<number> {
    const query = knex('dictionary_artists').count<{ count: number }[]>('* as count').first();
    if (groupId) (query as any).where('group_id', groupId);
    if (q) (query as any).where('name', 'like', `%${q}%`);
    const result = await query;
    return result?.count ?? 0;
  }

  async findById(id: number): Promise<DictionaryArtistEntity | null> {
    return (await knex('dictionary_artists').where('id', id).first()) ?? null;
  }

  async findByName(name: string): Promise<DictionaryArtistEntity | null> {
    return (await knex('dictionary_artists').where('name', name).first()) ?? null;
  }

  async create(
    data: Pick<DictionaryArtistEntity, 'name'> & { group_id?: number | null },
  ): Promise<number> {
    const result = await knex('dictionary_artists').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async update(id: number, data: Partial<DictionaryArtistEntity>): Promise<void> {
    await knex('dictionary_artists').where('id', id).update(data);
  }

  async delete(id: number): Promise<void> {
    await knex('dictionary_artists').where('id', id).delete();
  }

  async getMemberships(artistId: number): Promise<ArtistMembershipEntity[]> {
    return knex('dictionary_artist_memberships').where('artist_id', artistId);
  }

  async getActiveMemberships(artistId: number): Promise<ArtistMembershipEntity[]> {
    return knex('dictionary_artist_memberships')
      .where('artist_id', artistId)
      .where('status', 'active');
  }

  async addOrUpdateMembership(
    payload: Omit<ArtistMembershipEntity, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<number> {
    const existing = await knex('dictionary_artist_memberships')
      .where({
        artist_id: payload.artist_id,
        group_id: payload.group_id ?? null,
        activity_type: payload.activity_type,
      })
      .first();
    if (existing) {
      await knex('dictionary_artist_memberships').where('id', existing.id).update({
        status: payload.status,
        started_at: payload.started_at,
        ended_at: payload.ended_at,
        is_primary: payload.is_primary,
        updated_at: knex.fn.now(),
      });
      return existing.id;
    }
    const result = await knex('dictionary_artist_memberships')
      .insert({
        ...payload,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }
}

// ── Dictionary: Songs ────────────────────────────────────

export class KnexDictionarySongRepository implements IDictionarySongRepository {
  async findAll(q?: string, limit?: number, offset?: number): Promise<DictionarySongEntity[]> {
    const query = knex('dictionary_songs').select('*');
    if (q) query.where('title', 'like', `%${q}%`);
    if (limit != null) query.limit(limit);
    if (offset != null) query.offset(offset);
    return query.orderBy('title', 'asc');
  }

  async getAll(q?: string): Promise<DictionarySongEntity[]> {
    const query = knex('dictionary_songs').select('*');
    if (q) query.where('title', 'like', `%${q}%`);
    return query.orderBy('title', 'asc');
  }

  async count(q?: string): Promise<number> {
    const query = knex('dictionary_songs').count<{ count: number }[]>('* as count').first();
    if (q) (query as any).where('title', 'like', `%${q}%`);
    const result = await query;
    return result?.count ?? 0;
  }

  async findById(id: number): Promise<DictionarySongEntity | null> {
    return (await knex('dictionary_songs').where('id', id).first()) ?? null;
  }

  async findByTitle(title: string): Promise<DictionarySongEntity | null> {
    return (await knex('dictionary_songs').where('title', title).first()) ?? null;
  }

  async create(
    data: Pick<DictionarySongEntity, 'title'> & { artist?: string | null },
  ): Promise<number> {
    const result = await knex('dictionary_songs').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async update(id: number, data: Partial<DictionarySongEntity>): Promise<void> {
    await knex('dictionary_songs').where('id', id).update(data);
  }

  async delete(id: number): Promise<void> {
    await knex('dictionary_songs').where('id', id).delete();
  }

  async getSongArtists(songId: number): Promise<DictionaryArtistEntity[]> {
    return knex('dictionary_song_artists')
      .join('dictionary_artists', 'dictionary_song_artists.artist_id', 'dictionary_artists.id')
      .select('dictionary_artists.*')
      .where('dictionary_song_artists.song_id', songId);
  }

  async getSongGroups(songId: number): Promise<DictionaryGroupEntity[]> {
    return knex('dictionary_song_groups')
      .join('dictionary_groups', 'dictionary_song_groups.group_id', 'dictionary_groups.id')
      .select('dictionary_groups.*')
      .where('dictionary_song_groups.song_id', songId);
  }

  async linkArtist(songId: number, artistId: number): Promise<void> {
    await knex('dictionary_song_artists')
      .insert({ song_id: songId, artist_id: artistId })
      .onConflict(['song_id', 'artist_id'])
      .ignore();
  }

  async linkGroup(songId: number, groupId: number): Promise<void> {
    await knex('dictionary_song_groups')
      .insert({ song_id: songId, group_id: groupId })
      .onConflict(['song_id', 'group_id'])
      .ignore();
  }

  async unlinkArtist(songId: number, artistId: number): Promise<void> {
    await knex('dictionary_song_artists').where({ song_id: songId, artist_id: artistId }).delete();
  }

  async unlinkGroup(songId: number, groupId: number): Promise<void> {
    await knex('dictionary_song_groups').where({ song_id: songId, group_id: groupId }).delete();
  }
}

// ── Dictionary: Events ────────────────────────────────────

export class KnexDictionaryEventRepository implements IDictionaryEventRepository {
  async findAll(q?: string, limit?: number, offset?: number): Promise<DictionaryEventEntity[]> {
    const query = knex('dictionary_events').select('*');
    if (q) query.where('name', 'like', `%${q}%`);
    if (limit != null) query.limit(limit);
    if (offset != null) query.offset(offset);
    return query.orderBy('name', 'asc');
  }

  async getAll(q?: string): Promise<DictionaryEventEntity[]> {
    const query = knex('dictionary_events').select('*');
    if (q) query.where('name', 'like', `%${q}%`);
    return query.orderBy('name', 'asc');
  }

  async count(q?: string): Promise<number> {
    const query = knex('dictionary_events').count<{ count: number }[]>('* as count').first();
    if (q) (query as any).where('name', 'like', `%${q}%`);
    const result = await query;
    return result?.count ?? 0;
  }

  async findById(id: number): Promise<DictionaryEventEntity | null> {
    return (await knex('dictionary_events').where('id', id).first()) ?? null;
  }

  async findByName(name: string): Promise<DictionaryEventEntity | null> {
    return (await knex('dictionary_events').where('name', name).first()) ?? null;
  }

  async create(data: Pick<DictionaryEventEntity, 'name'>): Promise<number> {
    const result = await knex('dictionary_events').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async update(id: number, data: Partial<DictionaryEventEntity>): Promise<void> {
    await knex('dictionary_events').where('id', id).update(data);
  }

  async delete(id: number): Promise<void> {
    await knex('dictionary_events').where('id', id).delete();
  }
}

// ── Dictionary: Aliases ───────────────────────────────────

export class KnexDictionaryAliasRepository implements IDictionaryAliasRepository {
  async findByEntity(entityType: string, entityId: number): Promise<DictionaryAliasEntity[]> {
    return knex('dictionary_aliases').where({ entity_type: entityType, entity_id: entityId });
  }

  async findAll(entityType?: string): Promise<DictionaryAliasEntity[]> {
    const query = knex('dictionary_aliases').select('*');
    if (entityType) query.where('entity_type', entityType);
    return query.orderBy('alias', 'asc');
  }

  async add(entityType: string, entityId: number, alias: string): Promise<number> {
    const result = await knex('dictionary_aliases')
      .insert({ entity_type: entityType, entity_id: entityId, alias })
      .onConflict(['entity_type', 'entity_id', 'alias'])
      .ignore()
      .returning('id');
    const inserted = singleResult(result);
    if (!inserted) {
      const existing = await knex('dictionary_aliases')
        .where({ entity_type: entityType, entity_id: entityId, alias })
        .first();
      return existing?.id;
    }
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async remove(id: number): Promise<void> {
    await knex('dictionary_aliases').where('id', id).delete();
  }

  async resolve(entityType: string, name: string): Promise<DictionaryAliasEntity | null> {
    return (
      (await knex('dictionary_aliases').where({ entity_type: entityType, alias: name }).first()) ??
      null
    );
  }
}

// ── Settings ──────────────────────────────────────────────

export class KnexSettingsRepository implements ISettingsRepository {
  async getAll(): Promise<SettingsEntity[]> {
    return knex('settings').select('*');
  }

  async get(key: string): Promise<SettingsEntity | null> {
    return (await knex('settings').where('key', key).first()) ?? null;
  }

  async upsert(key: string, value: string): Promise<void> {
    await knex('settings').insert({ key, value }).onConflict('key').merge();
  }
}

// ── Video Lists ───────────────────────────────────────────

export class KnexVideoListRepository implements IVideoListRepository {
  async findAll(): Promise<VideoListEntity[]> {
    return knex('video_lists').select('*');
  }

  async findById(id: number): Promise<VideoListEntity | null> {
    return (await knex('video_lists').where('id', id).first()) ?? null;
  }

  async findWithVideos(id: number): Promise<{
    list: VideoListEntity;
    videos: Map<
      number,
      {
        id: number;
        title: string;
        artist: string | null;
        group: string | null;
        duration: number | null;
        tags: string[];
      }
    >;
  }> {
    const list = await knex('video_lists').where({ id }).first();
    if (!list) throw new Error('List not found');
    const rows = await knex('videos as v')
      .leftJoin('video_tags as vt', 'vt.video_id', 'v.id')
      .leftJoin('tags as t', 't.id', 'vt.tag_id')
      .where('v.video_list_id', id)
      .orderBy('v.updated_at', 'asc')
      .select(
        'v.id',
        'v.original_title as title',
        'v.artist_name as artist',
        'v.group_name as `group`',
        'v.duration_seconds as duration',
        't.name as tag',
      );
    const videos = new Map<
      number,
      {
        id: number;
        title: string;
        artist: string | null;
        group: string | null;
        duration: number | null;
        tags: string[];
      }
    >();
    for (const row of rows) {
      if (!videos.has(row.id))
        videos.set(row.id, {
          id: row.id,
          title: row.title,
          artist: row.artist,
          group: row.group,
          duration: row.duration,
          tags: [],
        });
      if (row.tag) videos.get(row.id)!.tags.push(row.tag);
    }
    return { list, videos };
  }

  async create(data: Pick<VideoListEntity, 'name' | 'color'>): Promise<number> {
    const result = await knex('video_lists').insert(data).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async update(id: number, data: Partial<VideoListEntity>): Promise<void> {
    await knex('video_lists').where('id', id).update(data);
  }

  async delete(id: number): Promise<void> {
    await knex('video_lists').where('id', id).delete();
  }

  async getVideoIds(listId: number): Promise<number[]> {
    const rows = await knex('videos').where('video_list_id', listId).select('id');
    return rows.map((r: { id: number }) => r.id);
  }

  async addVideos(listId: number, videoIds: number[]): Promise<void> {
    await knex('videos').whereIn('id', videoIds).update({ video_list_id: listId });
  }

  async removeVideos(listId: number, videoIds: number[]): Promise<void> {
    await knex('videos')
      .whereIn('id', videoIds)
      .where('video_list_id', listId)
      .update({ video_list_id: null });
  }

  async videoCount(listId: number): Promise<number> {
    const result = await knex('videos')
      .where({ video_list_id: listId })
      .count<{ count: number }>('id as count')
      .first();
    return result?.count ?? 0;
  }
}

// ── Event Log ─────────────────────────────────────────────

export class KnexEventLogRepository implements IEventLogRepository {
  async insert(
    eventType: string,
    description?: string | null,
    metadata?: string | null,
  ): Promise<number> {
    const result = await knex('event_log')
      .insert({ event_type: eventType, description, metadata })
      .returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async findAll(limit?: number, offset?: number, eventType?: string): Promise<EventLogEntity[]> {
    const query = knex('event_log').select('*');
    if (eventType) query.where('event_type', eventType);
    if (limit != null) query.limit(limit);
    if (offset != null) query.offset(offset);
    return query.orderBy('created_at', 'desc');
  }

  async count(eventType?: string): Promise<number> {
    const query = knex('event_log').count<{ count: number }[]>('* as count').first();
    if (eventType) (query as any).where('event_type', eventType);
    const result = await query;
    return result?.count ?? 0;
  }
}

// ── Duplicate Groups ──────────────────────────────────────

export class KnexDuplicateGroupRepository implements IDuplicateGroupRepository {
  async create(primaryVideoId?: number): Promise<number> {
    const result = await knex('duplicate_groups')
      .insert({ primary_video_id: primaryVideoId ?? null })
      .returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async findById(id: number): Promise<DuplicateGroupEntity | null> {
    return (await knex('duplicate_groups').where('id', id).first()) ?? null;
  }
}

// ── Singletons ────────────────────────────────────────────

export const channelRepository = new KnexChannelRepository();
export const playlistRepository = new KnexPlaylistRepository();
export const videoRepository = new KnexVideoRepository();
export const tagRepository = new KnexTagRepository();
export const dictionaryGroupRepository = new KnexDictionaryGroupRepository();
export const dictionaryArtistRepository = new KnexDictionaryArtistRepository();
export const dictionarySongRepository = new KnexDictionarySongRepository();
export const dictionaryEventRepository = new KnexDictionaryEventRepository();
export const dictionaryAliasRepository = new KnexDictionaryAliasRepository();
export const settingsRepository = new KnexSettingsRepository();
export const videoListRepository = new KnexVideoListRepository();
export const eventLogRepository = new KnexEventLogRepository();
export const duplicateGroupRepository = new KnexDuplicateGroupRepository();
