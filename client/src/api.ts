const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export interface Video {
  id: number;
  youtube_id: string;
  channel_id: string | null;
  playlist_id: string | null;
  original_title: string;
  perf_date: string | null;
  group_name: string | null;
  artist_name: string | null;
  song_title: string | null;
  event: string | null;
  camera_type: string | null;
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

export interface VideoTag {
  id: number;
  name: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VideosResponse {
  videos: Video[];
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

export interface BatchTagRequest {
  videoIds: number[];
  tagName: string;
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

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: isFormData
      ? options?.headers
      : {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function getVideos(filters?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<VideosResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));

  const queryString = params.toString();
  return fetchApi<VideosResponse>(`/videos${queryString ? '?' + queryString : ''}`);
}

export async function getVideo(id: number | string): Promise<Video> {
  return fetchApi<Video>(`/videos/${id}`);
}

export async function updateMetadata(
  id: number | string,
  data: {
    perf_date?: string | null;
    group_name?: string | null;
    artist_name?: string | null;
    song_title?: string | null;
    event?: string | null;
    camera_type?: string | null;
  },
): Promise<Video> {
  return fetchApi<Video>(`/videos/${id}/metadata`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getDictionary(
  type: 'groups' | 'artists' | 'songs' | 'events',
  query?: string,
): Promise<DictionaryResponse> {
  const params = new URLSearchParams({ type });
  if (query) params.set('q', query);
  return fetchApi<DictionaryResponse>(`/dictionary?${params.toString()}`);
}

export async function batchConfirmDownload(videoIds: number[]): Promise<BatchResult> {
  return fetchApi<BatchResult>('/videos/batch/confirm-download', {
    method: 'POST',
    body: JSON.stringify({ videoIds }),
  });
}

export async function batchComplete(videoIds: number[]): Promise<BatchResult> {
  return fetchApi<BatchResult>('/videos/batch/complete', {
    method: 'POST',
    body: JSON.stringify({ videoIds }),
  });
}

export async function reparseBatch(videoIds: number[]): Promise<{ updated: number }> {
  return fetchApi<{ updated: number }>('/parser/reparse-batch', {
    method: 'POST',
    body: JSON.stringify({ videoIds }),
  });
}

export async function getVideoTags(videoId: number | string): Promise<VideoTag[]> {
  return fetchApi<VideoTag[]>(`/videos/${videoId}/tags`);
}

export async function addTagToVideo(
  videoId: number | string,
  tagName: string,
  confirm = false,
): Promise<VideoTag> {
  return fetchApi<VideoTag>(`/videos/${videoId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name: tagName, confirm }),
  });
}

export async function removeTagFromVideo(videoId: number | string, tagId: number): Promise<void> {
  await fetchApi<unknown>(`/videos/${videoId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

export async function batchAddTags(
  videoIds: number[],
  tagName: string,
  confirm = false,
): Promise<BatchResult> {
  const payload: BatchTagRequest & { confirm?: boolean } = { videoIds, tagName, confirm };
  return fetchApi<BatchResult>('/videos/batch/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function batchRemoveTags(videoIds: number[], tagName: string): Promise<BatchResult> {
  const payload: BatchTagRequest = { videoIds, tagName };
  return fetchApi<BatchResult>('/videos/batch/tags', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export async function getChannels(page = 1, limit = 50): Promise<ChannelsResponse> {
  return fetchApi<ChannelsResponse>(`/channels?page=${page}&limit=${limit}`);
}

export async function addChannel(url: string): Promise<Channel> {
  return fetchApi<Channel>('/channels', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function deleteChannel(id: number, removeVideos = false): Promise<void> {
  await fetchApi<unknown>(`/channels/${id}?removeVideos=${removeVideos}`, {
    method: 'DELETE',
  });
}

export async function importChannels(file: File): Promise<ImportChannelsResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchApi<ImportChannelsResponse>('/channels/import', {
    method: 'POST',
    body: formData,
  });
}

export async function getPlaylists(page = 1, limit = 50): Promise<PlaylistsResponse> {
  return fetchApi<PlaylistsResponse>(`/playlists?page=${page}&limit=${limit}`);
}

export async function addPlaylist(url: string): Promise<Playlist> {
  return fetchApi<Playlist>('/playlists', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function deletePlaylist(id: number, removeVideos = false): Promise<void> {
  await fetchApi<unknown>(`/playlists/${id}?removeVideos=${removeVideos}`, {
    method: 'DELETE',
  });
}

export async function addVideo(url: string): Promise<Video> {
  return fetchApi<Video>('/videos/add', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}


export async function getEvents(params?: {
  page?: number;
  limit?: number;
  event_type?: string;
}): Promise<EventsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.event_type) searchParams.set('event_type', params.event_type);

  const query = searchParams.toString();
  return fetchApi<EventsResponse>(`/events${query ? `?${query}` : ''}`);
}
