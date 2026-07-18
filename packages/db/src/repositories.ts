import type { Knex } from 'knex';
import knex from './connection';
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
  IFileRepository,
  IVideoListRepository,
  IEventLogRepository,
  IErrorLogRepository,
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
  ErrorLogEntity,
  ErrorLogInsert,
  SettingsEntity,
  DuplicateGroupEntity,
  FileEntity,
  FileWithVideo,
  IVideoFilters,
} from './types';

/** Whether videos tagged shorts/private should be hidden from listings (env-driven). */
function hideFlaggedVideos(): boolean {
  return process.env.HIDE_FLAGGED_VIDEOS?.toLowerCase() === 'true';
}

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
    const rows = await knex('videos')
      .join('video_playlists', 'videos.id', 'video_playlists.video_id')
      .where('video_playlists.playlist_id', playlistId)
      .select('videos.youtube_id');
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
    const { status, includeIgnored, channelId, playlistId, videoListId, search } = filters;
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      query.where((b) =>
        b
          .whereRaw('LOWER(videos.original_title) LIKE ?', [term])
          .orWhere('videos.youtube_id', search),
      );
    }
    if (channelId)
      query.whereExists(
        knex('video_channels')
          .whereRaw('video_channels.video_id = videos.id')
          .where('video_channels.channel_id', channelId),
      );
    if (playlistId)
      query.whereExists(
        knex('video_playlists')
          .whereRaw('video_playlists.video_id = videos.id')
          .where('video_playlists.playlist_id', playlistId),
      );
    if (videoListId) query.where('videos.video_list_id', videoListId);
    if (status) query.where('videos.status', status);
    else if (!includeIgnored) query.whereNot('videos.status', 'ignored');
    if (hideFlaggedVideos()) {
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
        youtube_id: string;
        title: string;
        artist: string | null;
        group: string | null;
        duration: number | null;
        status: string;
        has_file: boolean;
        tags: string[];
        // Extra fields needed to render RENAME_TEMPLATE_VIDEO (see buildVideoContext) for the
        // predicted-filename preview — not shown as their own table columns.
        perf_date: string | null;
        event: string | null;
        camera_type: string | null;
        channel_title: string | null;
        playlist_title: string | null;
      }
    >;
  }> {
    const list = await knex('video_lists').where({ id }).first();
    if (!list) throw new Error('List not found');
    const baseQuery = knex('videos as v')
      .leftJoin('video_tags as vt', 'vt.video_id', 'v.id')
      .leftJoin('tags as t', 't.id', 'vt.tag_id')
      .leftJoin('channels as c', 'c.id', 'v.channel_id')
      .leftJoin('playlists as p', 'p.id', 'v.playlist_id')
      .where('v.video_list_id', id)
      .orderBy('v.updated_at', 'asc')
      .select(
        'v.id',
        'v.youtube_id as youtube_id',
        'v.original_title as title',
        'v.artist_name as artist',
        // No manual backticks: knex's query-builder .select() double-wraps a raw-backtick
        // alias string (producing a literal `group` column with backticks in the name) — let
        // knex quote the reserved word itself.
        'v.group_name as group',
        'v.duration_seconds as duration',
        'v.status as status',
        'v.perf_date as perf_date',
        'v.event as event',
        'v.camera_type as camera_type',
        'c.title as channel_title',
        'p.title as playlist_title',
        't.name as tag',
        knex.raw('EXISTS(SELECT 1 FROM files f WHERE f.video_id = v.id) as has_file'),
      );
    if (hideFlaggedVideos()) {
      baseQuery.whereNotIn('v.id', function () {
        this.select('v2.id')
          .from('videos as v2')
          .join('video_tags as vt2', 'vt2.video_id', 'v2.id')
          .join('tags as t2', 't2.id', 'vt2.tag_id')
          .whereIn('t2.name', ['shorts', 'private']);
      });
    }
    const rows = await baseQuery;
    const videos = new Map<
      number,
      {
        id: number;
        youtube_id: string;
        title: string;
        artist: string | null;
        group: string | null;
        duration: number | null;
        status: string;
        has_file: boolean;
        tags: string[];
        perf_date: string | null;
        event: string | null;
        camera_type: string | null;
        channel_title: string | null;
        playlist_title: string | null;
      }
    >();
    for (const row of rows) {
      if (!videos.has(row.id))
        videos.set(row.id, {
          id: row.id,
          youtube_id: row.youtube_id,
          title: row.title,
          artist: row.artist,
          group: row.group,
          duration: row.duration,
          status: row.status,
          has_file: Boolean(row.has_file),
          tags: [],
          perf_date: row.perf_date,
          event: row.event,
          camera_type: row.camera_type,
          channel_title: row.channel_title,
          playlist_title: row.playlist_title,
        });
      if (row.tag) videos.get(row.id)!.tags.push(row.tag);
    }
    return { list, videos };
  }

  async create(
    data: Pick<VideoListEntity, 'name' | 'color'> & { status?: string | null },
  ): Promise<number> {
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

  async getMemberStatuses(listId: number): Promise<string[]> {
    const rows = await knex('videos').where('video_list_id', listId).distinct('status');
    return rows.map((r: { status: string }) => r.status);
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

// ── Error Log ─────────────────────────────────────────────

export class KnexErrorLogRepository implements IErrorLogRepository {
  async insert(entry: ErrorLogInsert): Promise<number> {
    const result = await knex('error_log').insert(entry).returning('id');
    const inserted = singleResult(result);
    return typeof inserted === 'object' ? inserted.id : inserted;
  }

  async findAll(limit?: number, offset?: number): Promise<ErrorLogEntity[]> {
    const query = knex('error_log').select('*');
    if (limit != null) query.limit(limit);
    if (offset != null) query.offset(offset);
    // id as the secondary key keeps ordering stable when rows share a created_at timestamp.
    return query.orderBy('created_at', 'desc').orderBy('id', 'desc');
  }

  async count(): Promise<number> {
    const result = await knex('error_log').count<{ count: number }[]>('* as count').first();
    return result?.count ?? 0;
  }

  async clear(): Promise<void> {
    await knex('error_log').del();
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

// ── Files ─────────────────────────────────────────────────

export class KnexFileRepository implements IFileRepository {
  private withVideo() {
    return knex('files as f')
      .leftJoin('videos as v', 'f.video_id', 'v.id')
      .select('f.*', 'v.original_title as video_title');
  }

  async getAll(params?: {
    videoId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ files: FileWithVideo[]; total: number }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    const baseFilter = (qb: Knex.QueryBuilder) => {
      if (params?.videoId != null) qb.where('f.video_id', params.videoId);
    };

    const rowsQuery = this.withVideo()
      .modify(baseFilter)
      .orderBy('f.scanned_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    const countQuery = knex('files as f')
      .modify(baseFilter)
      .count<{ count: number }>('f.id as count')
      .first();

    const [files, countResult] = await Promise.all([rowsQuery, countQuery]);
    return { files: files as FileWithVideo[], total: Number(countResult?.count ?? 0) };
  }

  async getById(id: number): Promise<FileWithVideo | null> {
    return ((await this.withVideo().where('f.id', id).first()) as FileWithVideo) ?? null;
  }

  async upsert(data: Omit<FileEntity, 'id' | 'scanned_at' | 'width' | 'height'>): Promise<void> {
    await knex('files')
      .insert({ ...data, scanned_at: knex.fn.now() })
      .onConflict(['directory', 'filename'])
      .merge({
        extension: data.extension,
        size_bytes: data.size_bytes,
        youtube_id: data.youtube_id,
        scanned_at: knex.fn.now(),
      });
  }

  async linkVideo(id: number, videoId: number | null): Promise<void> {
    await knex('files').where('id', id).update({ video_id: videoId });
  }

  /** Update a file's location after it is moved on disk. */
  async updatePath(id: number, directory: string, filename: string): Promise<void> {
    await knex('files').where('id', id).update({ directory, filename, scanned_at: knex.fn.now() });
  }

  /** Link every unlinked file whose youtube_id matches a video. Returns rows linked. */
  async linkAllByYoutubeId(): Promise<number> {
    const matchesUnlinked = (qb: Knex.QueryBuilder) =>
      qb
        .from('files')
        .whereNull('files.video_id')
        .whereNotNull('files.youtube_id')
        .whereExists((sub) => sub.from('videos').whereRaw('videos.youtube_id = files.youtube_id'));

    const before = await matchesUnlinked(knex.queryBuilder())
      .count<{ count: number }>('files.id as count')
      .first();

    await knex.raw(
      `UPDATE files
         SET video_id = (SELECT id FROM videos WHERE videos.youtube_id = files.youtube_id)
       WHERE video_id IS NULL
         AND youtube_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM videos WHERE videos.youtube_id = files.youtube_id)`,
    );

    return Number(before?.count ?? 0);
  }

  /**
   * Link every unlinked file whose youtube_id matches one of `youtubeIds` (a subset of
   * linkAllByYoutubeId, scoped to e.g. a video list's videos). Returns rows linked.
   */
  async linkByYoutubeIds(youtubeIds: string[]): Promise<number> {
    if (youtubeIds.length === 0) return 0;

    const matchesUnlinked = (qb: Knex.QueryBuilder) =>
      qb
        .from('files')
        .whereNull('files.video_id')
        .whereIn('files.youtube_id', youtubeIds)
        .whereExists((sub) => sub.from('videos').whereRaw('videos.youtube_id = files.youtube_id'));

    const before = await matchesUnlinked(knex.queryBuilder())
      .count<{ count: number }>('files.id as count')
      .first();

    await knex('files')
      .whereNull('video_id')
      .whereIn('youtube_id', youtubeIds)
      .whereExists((sub) =>
        sub.select(knex.raw('1')).from('videos').whereRaw('videos.youtube_id = files.youtube_id'),
      )
      .update({
        video_id: knex.raw('(SELECT id FROM videos WHERE videos.youtube_id = files.youtube_id)'),
      });

    return Number(before?.count ?? 0);
  }

  async deleteById(id: number): Promise<void> {
    await knex('files').where('id', id).del();
  }

  async updateDimensions(id: number, width: number | null, height: number | null): Promise<void> {
    await knex('files').where('id', id).update({ width, height });
  }

  /** Files already linked to a video but never successfully probed. */
  async getUnprobedLinked(): Promise<FileEntity[]> {
    return knex('files').whereNotNull('video_id').whereNull('width');
  }

  /** First linked file's dimensions per video (lowest id) — one video can have several files. */
  async getDimensionsByVideoIds(
    videoIds: number[],
  ): Promise<Map<number, { width: number | null; height: number | null }>> {
    if (videoIds.length === 0) return new Map();
    const rows = await knex('files')
      .whereIn('video_id', videoIds)
      .orderBy('id', 'asc')
      .select('video_id', 'width', 'height');
    const map = new Map<number, { width: number | null; height: number | null }>();
    for (const row of rows) {
      if (!map.has(row.video_id)) map.set(row.video_id, { width: row.width, height: row.height });
    }
    return map;
  }

  async getPreviews(fileId: number): Promise<Buffer[]> {
    const rows = await knex('file_previews')
      .where('file_id', fileId)
      .orderBy('position', 'asc')
      .select('image');
    return rows.map((r) => r.image as Buffer);
  }

  async replacePreviews(fileId: number, images: Buffer[]): Promise<void> {
    // Wholesale replace so a regeneration never mixes old and new frames or leaves stale rows.
    await knex.transaction(async (trx) => {
      await trx('file_previews').where('file_id', fileId).del();
      if (images.length === 0) return;
      await trx('file_previews').insert(
        images.map((image, position) => ({ file_id: fileId, position, image })),
      );
    });
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
export const fileRepository = new KnexFileRepository();
export const videoListRepository = new KnexVideoListRepository();
export const eventLogRepository = new KnexEventLogRepository();
export const errorLogRepository = new KnexErrorLogRepository();
export const duplicateGroupRepository = new KnexDuplicateGroupRepository();
