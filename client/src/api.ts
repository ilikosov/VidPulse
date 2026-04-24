const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export interface Video {
  id: string;
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

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
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

export async function getVideo(id: string): Promise<Video> {
  return fetchApi<Video>(`/videos/${id}`);
}

export async function updateMetadata(
  id: string,
  data: {
    perf_date?: string | null;
    group_name?: string | null;
    artist_name?: string | null;
    song_title?: string | null;
    event?: string | null;
    camera_type?: string | null;
  }
): Promise<Video> {
  return fetchApi<Video>(`/videos/${id}/metadata`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getDictionary(type: 'groups' | 'artists' | 'songs' | 'events', query?: string): Promise<DictionaryResponse> {
  const params = new URLSearchParams({ type });
  if (query) params.set('q', query);
  return fetchApi<DictionaryResponse>(`/dictionary?${params.toString()}`);
}
