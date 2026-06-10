export type DictionaryGroupType = 'male' | 'female' | 'mixed';

export interface Video {
  id: number;
  youtube_id: string;
  channel_id: string | null;
  playlist_id: string | null;
  original_title: string;
  description?: string | null;
  perf_date: string | null;
  group_id?: number | null;
  artist_id?: number | null;
  song_id?: number | null;
  event_id?: number | null;
  group_name: string | null;
  artist_name: string | null;
  song_title: string | null;
  songs?: VideoSong[];
  event: string | null;
  camera_type: string | null;
  is_own_group_song?: boolean | null;
  is_own_artist_song?: boolean | null;
  status: string;
  created_at: string;
  updated_at: string;
  channel_title?: string;
  playlist_title?: string;
  channel_youtube_id?: string;
  published_at?: string;
  duration_seconds?: number | null;
  tags?: VideoTag[];
}

export interface SuggestedMetadata {
  group_name?: string;
  artist_name?: string;
  song_title?: string;
  event?: string;
  perf_date?: string;
  camera_type?: string;
  is_own_group_song?: boolean | null;
  is_own_artist_song?: boolean | null;
}

export interface VideoTag {
  id: number;
  name: string;
}

export interface VideoSong {
  id: number;
  title: string;
}

export interface ParserLog {
  input: {
    title: string;
    publishedAt?: string | null;
    tags?: string[];
    description?: string | null;
  };
  output?: unknown;
  error?: string;
}

export interface ReparseResponse {
  video: Video;
  reparseLog: ParserLog;
}

export interface ResyncResponse {
  status?: string;
  video: Video;
  resyncLog: {
    youtubeResponse?: unknown;
    youtubeError?: string;
    parseLog: ParserLog;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface VideosResponse {
  videos: Video[];
  pagination: Pagination;
}

export interface PaginatedGroupsResponse {
  items: Array<{ id: number; name: string; type: string; active: boolean; artist_count?: number }>;
  pagination: Pagination;
}

export interface PaginatedArtistsResponse {
  items: Array<{ id: number; name: string; group_id: number; group_name: string | null }>;
  pagination: Pagination;
}

export interface PaginatedSongsResponse {
  items: Array<{ id: number; title: string; artist: string | null }>;
  pagination: Pagination;
}

export interface PaginatedEventsResponse {
  events: EventLogEntry[];
  pagination: Pagination;
}

export interface DictionaryResponse {
  results: string[];
  type: string;
  query: string;
}

export interface BatchResultError {
  videoId: number;
  error: string;
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors?: BatchResultError[];
}

export interface Channel {
  id: number;
  youtube_id: string;
  title: string;
  thumbnail_url?: string | null;
  is_favorite?: boolean;
  added_at: string;
  last_checked_at?: string | null;
}

export interface Playlist {
  id: number;
  youtube_id: string;
  title: string;
  added_at: string;
  last_checked_at?: string | null;
}

export interface ChannelsResponse {
  channels: Channel[];
  pagination: Pagination;
}

export interface PlaylistsResponse {
  playlists: Playlist[];
  pagination: Pagination;
}

export interface ImportChannelsResponse {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
}

export interface EventLogEntry {
  id: number;
  event_type: string;
  description: string | null;
  metadata: string | null;
  created_at: string;
}

export interface EventsResponse {
  events: EventLogEntry[];
  pagination: Pagination;
}

export interface DictionaryGroup {
  id: number;
  name: string;
  type: DictionaryGroupType;
  active: boolean;
  artist_count?: number;
  song_count?: number;
  video_count?: number;
  aliases_count?: number;
  artists?: Array<{ id: number; name: string; group_id: number }>;
}

export interface DictionaryArtist {
  id: number;
  name: string;
  group_id: number;
  group_name: string | null;
  songs_count?: number;
  videos_count?: number;
  aliases_count?: number;
}

export interface DictionarySong {
  id: number;
  title: string;
  artist: string | null;
  artist_id?: number;
  artist_name?: string | null;
  group_id?: number;
  group_name?: string | null;
  videos_count?: number;
  aliases_count?: number;
}

export interface DictionaryEvent {
  id: number;
  name: string;
}

export type DictionaryAliasEntityType = 'group' | 'artist' | 'song' | 'event';

export interface DictionaryAlias {
  id: number;
  alias: string;
}

export interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
  group_id?: number;
  artist_id?: number;
}

export interface GroupsListParams extends ListParams {
  type?: string;
}

export interface ArtistsListParams extends ListParams {
  group_id?: number;
}

export interface PaginatedList<T> {
  items: T[];
  pagination: Pagination;
}

// Request types

export interface UpdateVideoMetadataRequest {
  perf_date?: string | null;
  group_name?: string | null;
  artist_name?: string | null;
  song_title?: string | null;
  song_titles?: string[];
  event?: string | null;
  camera_type?: string | null;
  video_category?: string | null;
}

export interface BatchTagRequest {
  videoIds: number[];
  tagName: string;
  confirm?: boolean;
}

export interface AddByUrlRequest {
  url: string;
}

export interface SaveSettingRequest {
  key: string;
  value: string;
}

export interface DictionaryGroupRequest {
  name: string;
  type: string;
  active?: boolean;
}

export interface DictionaryArtistRequest {
  name: string;
  group_id: number;
}

export interface DictionarySongRequest {
  title: string;
  artist: string;
  artist_ids?: number[];
  group_ids?: number[];
}

export interface DictionaryEventRequest {
  name: string;
}

export interface DictionaryAliasRequest {
  alias: string;
}

export type ImportStartResponse = { jobId: string };

export interface VideoListSummary {
  id: number;
  name: string;
  color: string;
  /** Shared status of the videos in the list; null when the list is empty or mixed. */
  status?: string | null;
  countVideos: number;
  created_at?: string;
  updated_at?: string;
}

export interface VideoListVideo {
  id: number;
  youtube_id: string;
  title: string;
  artist: string | null;
  group: string | null;
  duration: number | null;
  status?: string | null;
  has_file: boolean;
  tags: string[];
}

export interface VideoListDetails extends VideoListSummary {
  videos: VideoListVideo[];
}

export interface CreateVideoListRequest {
  name: string;
  videoIds?: number[];
}

export interface VideoListVideosRequest {
  videoIds: number[];
}

export interface RenameVideoListRequest {
  name: string;
}

export interface VideoListBatchOperationRequest {
  operation: string;
  /** Optional: only used by removeFromList; status operations apply to the whole list. */
  videoIds?: number[];
  /** Required for addTag / removeTag. */
  tagName?: string;
  /** Required to apply protected tags (shorts, long_video, private). */
  confirm?: boolean;
}

export interface VideoListOperationResponse {
  operation?: string;
  processed: number;
  succeeded?: number;
  skipped?: number;
  failed?: number;
  errors?: Array<{ videoId: number; error: string }>;
  /** List status after the operation; null when empty or mixed. */
  status?: string | null;
}

// ── Files ─────────────────────────────────────────────────

/** A physical file on disk, optionally linked to a video by youtube_id prefix. */
export interface FileRecord {
  id: number;
  filename: string;
  directory: string;
  extension: string | null;
  size_bytes: number | null;
  youtube_id: string | null;
  video_id: number | null;
  /** Joined from the linked video, when present. */
  video_title?: string | null;
  scanned_at: string;
}

export interface FilesResponse {
  files: FileRecord[];
  total: number;
}

export interface ScanResult {
  scanned: number;
  linked: number;
  errors: string[];
}

export interface LinkFileRequest {
  videoId: number | null;
}
