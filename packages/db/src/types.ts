import type { Knex } from 'knex';

// ── Entity types ──────────────────────────────────────────

export interface ChannelEntity {
  id: number;
  youtube_id: string;
  title: string;
  thumbnail_url?: string | null;
  is_favorite: boolean;
  added_at: string;
  last_checked_at?: string | null;
}

export interface PlaylistEntity {
  id: number;
  youtube_id: string;
  title: string;
  added_at: string;
  last_checked_at?: string | null;
  next_page_token?: string | null;
}

export interface VideoInsertData {
  [key: string]: unknown;
  youtube_id: string;
}

export interface VideoEntity {
  id: number;
  youtube_id: string;
  channel_id: number;
  playlist_id?: number | null;
  original_title: string;
  url?: string | null;
  published_at?: string | null;
  status: string;
  duplicate_group_id?: number | null;
  perf_date?: string | null;
  group_name?: string | null;
  artist_name?: string | null;
  song_title?: string | null;
  event?: string | null;
  camera_type?: string | null;
  file_path?: string | null;
  preview_path?: string | null;
  error_log?: string | null;
  duration_seconds?: number | null;
  description?: string | null;
  is_fancam?: boolean | null;
  fancam_confidence?: number | null;
  group_id?: number | null;
  artist_id?: number | null;
  song_id?: number | null;
  event_id?: number | null;
  is_own_group_song?: boolean | null;
  is_own_artist_song?: boolean | null;
  video_list_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TagEntity {
  id: number;
  name: string;
}

export interface VideoTagEntity {
  video_id: number;
  tag_id: number;
}

export interface VideoSongEntity {
  video_id: number;
  position: number;
  raw_title: string;
  song_id?: number | null;
}

export interface DictionaryGroupEntity {
  id: number;
  name: string;
  type: string;
  active: boolean;
  /** ISO timestamp of the last MusicBrainz song enrichment; null/undefined = never enriched. */
  songs_enriched_at?: string | null;
}

export interface DictionaryArtistEntity {
  id: number;
  name: string;
  group_id?: number | null;
}

export interface DictionarySongEntity {
  id: number;
  title: string;
  artist?: string | null;
}

export interface DictionaryEventEntity {
  id: number;
  name: string;
}

export interface DictionaryAliasEntity {
  id: number;
  entity_type: string;
  entity_id: number;
  alias: string;
}

export interface ArtistMembershipEntity {
  id: number;
  artist_id: number;
  group_id?: number | null;
  activity_type: string;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoListEntity {
  id: number;
  name: string;
  color: string;
  status?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventLogEntity {
  id: number;
  event_type: string;
  description?: string | null;
  metadata?: string | null;
  created_at: string;
}

export interface ErrorLogEntity {
  id: number;
  name: string | null;
  message: string;
  stack: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  context: string | null;
  created_at: string;
}

/** Fields accepted when recording an error (id/created_at are assigned by the DB). */
export interface ErrorLogInsert {
  message: string;
  name?: string | null;
  stack?: string | null;
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  context?: string | null;
}

export interface SettingsEntity {
  key: string;
  value: string;
}

export interface DuplicateGroupEntity {
  id: number;
  primary_video_id?: number | null;
  created_at: string;
}

export interface FileEntity {
  id: number;
  filename: string;
  directory: string;
  extension: string | null;
  size_bytes: number | null;
  youtube_id: string | null;
  video_id: number | null;
  width: number | null;
  height: number | null;
  scanned_at: string;
}

/** FileEntity joined with the linked video's title. */
export interface FileWithVideo extends FileEntity {
  video_title: string | null;
}

/** One stored preview frame (raw JPEG bytes) for a file, ordered by `position`. */
export interface FilePreviewEntity {
  id: number;
  file_id: number;
  position: number;
  image: Buffer;
  created_at: string;
}

export interface StatusHistoryEntity {
  id: number;
  video_id: number;
  old_status?: string | null;
  new_status: string;
  changed_at: string;
}

export interface SongArtistLink {
  song_id: number;
  artist_id: number;
}

export interface SongGroupLink {
  song_id: number;
  group_id: number;
}

// ── Repository interfaces ─────────────────────────────────

export interface IVideoFilters {
  status?: string;
  includeIgnored?: boolean;
  channelId?: string;
  playlistId?: string;
  videoListId?: string;
  /** Matches a substring of `original_title` (case-insensitive) or an exact `youtube_id`. */
  search?: string;
}

export interface IVideoRepository {
  findByYoutubeId(youtubeId: string): Promise<VideoEntity | null>;
  findYoutubeIdsByPlaylistId(playlistId: number): Promise<Set<string>>;
  insert(data: VideoInsertData): Promise<number>;
  findById(id: number): Promise<VideoEntity | null>;
  findByIdDisplay(id: number): Promise<VideoEntity | null>;
  findAllDisplay(
    filters: IVideoFilters,
    pagination: { limit: number; offset: number },
  ): Promise<VideoEntity[]>;
  findAll(
    filters: IVideoFilters,
    pagination: { limit: number; offset: number },
  ): Promise<VideoEntity[]>;
  countAll(filters: IVideoFilters): Promise<number>;
  update(id: number, data: Partial<VideoEntity>): Promise<void>;
  updateMultiple(ids: number[], data: Partial<VideoEntity>): Promise<void>;
  delete(id: number): Promise<void>;
}

export interface ITagRepository {
  findOrCreate(name: string): Promise<number>;
  findByName(name: string): Promise<TagEntity | null>;
  findAll(): Promise<TagEntity[]>;
  getVideoTags(videoId: number): Promise<Array<{ id: number; name: string }>>;
  getVideosTagsMap(videoIds: number[]): Promise<Map<number, Array<{ id: number; name: string }>>>;
  addVideoTag(videoId: number, tagId: number): Promise<void>;
  removeVideoTag(videoId: number, tagId: number): Promise<void>;
  batchAddTags(videoIds: number[], tagId: number): Promise<number>;
  batchRemoveTags(videoIds: number[], tagId: number): Promise<number>;
  isProtected(name: string): boolean;
  getProtectedNames(): string[];
}

export interface IChannelRepository {
  getAll(): Promise<ChannelEntity[]>;
  findAllPaginated(limit: number, offset: number): Promise<ChannelEntity[]>;
  count(): Promise<number>;
  updateLastCheckedAt(id: number, isoDate: string): Promise<void>;
  findByYoutubeId(youtubeId: string): Promise<ChannelEntity | null>;
  findById(id: number): Promise<ChannelEntity | null>;
  insert(data: Partial<ChannelEntity>): Promise<number>;
  delete(id: number): Promise<void>;
}

export interface IPlaylistRepository {
  getAll(): Promise<PlaylistEntity[]>;
  findAllPaginated(limit: number, offset: number): Promise<PlaylistEntity[]>;
  count(): Promise<number>;
  updateLastCheckedAt(id: number, isoDate: string): Promise<void>;
  findByYoutubeId(youtubeId: string): Promise<PlaylistEntity | null>;
  findById(id: number): Promise<PlaylistEntity | null>;
  insert(data: Partial<PlaylistEntity>): Promise<number>;
  delete(id: number): Promise<void>;
}

export interface IDictionaryGroupRepository {
  findAll(
    type?: string,
    q?: string,
    limit?: number,
    offset?: number,
  ): Promise<DictionaryGroupEntity[]>;
  getAll(type?: string, q?: string): Promise<DictionaryGroupEntity[]>;
  count(type?: string, q?: string): Promise<number>;
  findById(id: number): Promise<DictionaryGroupEntity | null>;
  findByName(name: string): Promise<DictionaryGroupEntity | null>;
  create(data: Pick<DictionaryGroupEntity, 'name' | 'type'>): Promise<number>;
  update(id: number, data: Partial<DictionaryGroupEntity>): Promise<void>;
  delete(id: number): Promise<void>;
}

export interface IDictionaryArtistRepository {
  findAll(
    groupId?: number,
    q?: string,
    limit?: number,
    offset?: number,
  ): Promise<DictionaryArtistEntity[]>;
  getAll(groupId?: number, q?: string): Promise<DictionaryArtistEntity[]>;
  count(groupId?: number, q?: string): Promise<number>;
  findById(id: number): Promise<DictionaryArtistEntity | null>;
  findByName(name: string): Promise<DictionaryArtistEntity | null>;
  create(
    data: Pick<DictionaryArtistEntity, 'name'> & { group_id?: number | null },
  ): Promise<number>;
  update(id: number, data: Partial<DictionaryArtistEntity>): Promise<void>;
  delete(id: number): Promise<void>;
  getMemberships(artistId: number): Promise<ArtistMembershipEntity[]>;
  getActiveMemberships(artistId: number): Promise<ArtistMembershipEntity[]>;
  addOrUpdateMembership(
    payload: Omit<ArtistMembershipEntity, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<number>;
}

export interface IDictionarySongRepository {
  findAll(q?: string, limit?: number, offset?: number): Promise<DictionarySongEntity[]>;
  getAll(q?: string): Promise<DictionarySongEntity[]>;
  count(q?: string): Promise<number>;
  findById(id: number): Promise<DictionarySongEntity | null>;
  findByTitle(title: string): Promise<DictionarySongEntity | null>;
  create(data: Pick<DictionarySongEntity, 'title'> & { artist?: string | null }): Promise<number>;
  update(id: number, data: Partial<DictionarySongEntity>): Promise<void>;
  delete(id: number): Promise<void>;
  getSongArtists(songId: number): Promise<DictionaryArtistEntity[]>;
  getSongGroups(songId: number): Promise<DictionaryGroupEntity[]>;
  linkArtist(songId: number, artistId: number): Promise<void>;
  linkGroup(songId: number, groupId: number): Promise<void>;
  unlinkArtist(songId: number, artistId: number): Promise<void>;
  unlinkGroup(songId: number, groupId: number): Promise<void>;
}

export interface IDictionaryEventRepository {
  findAll(q?: string, limit?: number, offset?: number): Promise<DictionaryEventEntity[]>;
  getAll(q?: string): Promise<DictionaryEventEntity[]>;
  count(q?: string): Promise<number>;
  findById(id: number): Promise<DictionaryEventEntity | null>;
  findByName(name: string): Promise<DictionaryEventEntity | null>;
  create(data: Pick<DictionaryEventEntity, 'name'>): Promise<number>;
  update(id: number, data: Partial<DictionaryEventEntity>): Promise<void>;
  delete(id: number): Promise<void>;
}

export interface IDictionaryAliasRepository {
  findByEntity(entityType: string, entityId: number): Promise<DictionaryAliasEntity[]>;
  findAll(entityType?: string): Promise<DictionaryAliasEntity[]>;
  add(entityType: string, entityId: number, alias: string): Promise<number>;
  remove(id: number): Promise<void>;
  resolve(entityType: string, name: string): Promise<DictionaryAliasEntity | null>;
}

export interface ISettingsRepository {
  getAll(): Promise<SettingsEntity[]>;
  get(key: string): Promise<SettingsEntity | null>;
  upsert(key: string, value: string): Promise<void>;
}

export interface IFileRepository {
  getAll(params?: {
    videoId?: number;
    page?: number;
    limit?: number;
  }): Promise<{ files: FileWithVideo[]; total: number }>;
  getById(id: number): Promise<FileWithVideo | null>;
  upsert(data: Omit<FileEntity, 'id' | 'scanned_at' | 'width' | 'height'>): Promise<void>;
  linkVideo(id: number, videoId: number | null): Promise<void>;
  updatePath(id: number, directory: string, filename: string): Promise<void>;
  linkAllByYoutubeId(): Promise<number>;
  linkByYoutubeIds(youtubeIds: string[]): Promise<number>;
  deleteById(id: number): Promise<void>;
  updateDimensions(id: number, width: number | null, height: number | null): Promise<void>;
  getUnprobedLinked(): Promise<FileEntity[]>;
  getPathsByVideoIds(
    videoIds: number[],
  ): Promise<Array<{ video_id: number; directory: string; filename: string }>>;
  getDimensionsByVideoIds(
    videoIds: number[],
  ): Promise<Map<number, { width: number | null; height: number | null }>>;
  /** Stored preview frames for a file, ordered by position (empty if none generated yet). */
  getPreviews(fileId: number): Promise<Buffer[]>;
  /** Replace all of a file's stored previews with `images` (positions 0..n-1), atomically. */
  replacePreviews(fileId: number, images: Buffer[]): Promise<void>;
}

export interface VideoListVideoRow {
  id: number;
  title: string;
  artist: string | null;
  group: string | null;
  duration: number | null;
  tag: string | null;
}

export interface IVideoListRepository {
  findAll(): Promise<VideoListEntity[]>;
  findById(id: number): Promise<VideoListEntity | null>;
  findWithVideos(id: number): Promise<{
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
      }
    >;
  }>;
  create(
    data: Pick<VideoListEntity, 'name' | 'color'> & { status?: string | null },
  ): Promise<number>;
  update(id: number, data: Partial<VideoListEntity>): Promise<void>;
  delete(id: number): Promise<void>;
  getVideoIds(listId: number): Promise<number[]>;
  getMemberStatuses(listId: number): Promise<string[]>;
  addVideos(listId: number, videoIds: number[]): Promise<void>;
  removeVideos(listId: number, videoIds: number[]): Promise<void>;
  videoCount(listId: number): Promise<number>;
}

export interface IEventLogRepository {
  insert(eventType: string, description?: string | null, metadata?: string | null): Promise<number>;
  findAll(limit?: number, offset?: number, eventType?: string): Promise<EventLogEntity[]>;
  count(eventType?: string): Promise<number>;
}

export interface IErrorLogRepository {
  insert(entry: ErrorLogInsert): Promise<number>;
  findAll(limit?: number, offset?: number): Promise<ErrorLogEntity[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export interface IDuplicateGroupRepository {
  create(primaryVideoId?: number): Promise<number>;
  findById(id: number): Promise<DuplicateGroupEntity | null>;
}

export type KnexTransaction = Knex.Transaction;
