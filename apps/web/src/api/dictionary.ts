import type { Video, VideosResponse } from '../api';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';
const req = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: isFormData
      ? options?.headers
      : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
};

export type DictionaryGroupType = 'male' | 'female' | 'mixed';

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
export type DictionaryAliasEntityType = 'group' | 'artist' | 'song' | 'event';
export interface DictionaryAlias {
  id: number;
  alias: string;
}

export type ImportStartResponse = { jobId: string };

interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
  group_id?: number;
  artist_id?: number;
}
interface GroupsListParams extends ListParams {
  type?: string;
}
interface ArtistsListParams extends ListParams {
  group_id?: number;
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
interface PaginatedList<T> {
  items: T[];
  pagination: Pagination;
}
type LegacyOrPaginated<T> =
  | T[]
  | {
      items?: T[];
      groups?: T[];
      artists?: T[];
      songs?: T[];
      events?: T[];
      pagination?: Pagination;
    };

const toQuery = (params: object) => {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.set(k, String(v));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

const toPageData = <T>(rows: T[], params: ListParams): PaginatedList<T> => {
  const total = rows.length;
  const limit = params.limit || total || 1;
  return {
    items: rows,
    pagination: { page: params.page || 1, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
};

const normalizePaginatedResponse = <T>(
  response: LegacyOrPaginated<T>,
  key: 'groups' | 'artists' | 'songs' | 'events',
  params: ListParams,
): PaginatedList<T> => {
  if (Array.isArray(response)) return toPageData(response, params);

  const rawItems = response.items ?? response[key] ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [];
  const generatedPagination = toPageData(items, params).pagination;

  return {
    items,
    pagination: response.pagination ?? generatedPagination,
  };
};

export const dictionaryApi = {
  getGroupsList: async (params: GroupsListParams): Promise<PaginatedList<DictionaryGroup>> =>
    normalizePaginatedResponse(
      await req<LegacyOrPaginated<DictionaryGroup>>(`/dictionary/groups/list${toQuery(params)}`),
      'groups',
      params,
    ),
  getArtistsList: async (params: ArtistsListParams): Promise<PaginatedList<DictionaryArtist>> =>
    normalizePaginatedResponse(
      await req<LegacyOrPaginated<DictionaryArtist>>(`/dictionary/artists/list${toQuery(params)}`),
      'artists',
      params,
    ),
  getSongsList: async (params: ListParams): Promise<PaginatedList<DictionarySong>> =>
    normalizePaginatedResponse(
      await req<LegacyOrPaginated<DictionarySong>>(`/dictionary/songs/list${toQuery(params)}`),
      'songs',
      params,
    ),
  getEventsList: async (params: ListParams): Promise<PaginatedList<{ id: number; name: string }>> =>
    normalizePaginatedResponse(
      await req<LegacyOrPaginated<{ id: number; name: string }>>(
        `/dictionary/events/list${toQuery(params)}`,
      ),
      'events',
      params,
    ),
  getGroups: async () => (await dictionaryApi.getGroupsList({ page: 1, limit: 1000 })).items,
  createGroup: (d: any) => req('/dictionary/groups', { method: 'POST', body: JSON.stringify(d) }),
  updateGroup: (id: number, d: any) =>
    req(`/dictionary/groups/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteGroup: (id: number) => req(`/dictionary/groups/${id}`, { method: 'DELETE' }),
  getArtists: async (groupId?: number) =>
    (await dictionaryApi.getArtistsList({ page: 1, limit: 1000, group_id: groupId })).items,
  createArtist: (d: any) => req('/dictionary/artists', { method: 'POST', body: JSON.stringify(d) }),
  updateArtist: (id: number, d: any) =>
    req(`/dictionary/artists/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteArtist: (id: number) => req(`/dictionary/artists/${id}`, { method: 'DELETE' }),
  getSongs: async () => (await dictionaryApi.getSongsList({ page: 1, limit: 1000 })).items,
  createSong: (d: any) => req('/dictionary/songs', { method: 'POST', body: JSON.stringify(d) }),
  updateSong: (id: number, d: any) =>
    req(`/dictionary/songs/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteSong: (id: number) => req(`/dictionary/songs/${id}`, { method: 'DELETE' }),
  getEvents: async () => (await dictionaryApi.getEventsList({ page: 1, limit: 1000 })).items,
  getEvent: (id: number | string) => req<{ id: number; name: string }>(`/dictionary/events/${id}`),
  getEventVideos: (id: number | string, page = 1, limit = 20) =>
    req<VideosResponse>(`/dictionary/events/${id}/videos?page=${page}&limit=${limit}`),
  createEvent: (d: any) => req('/dictionary/events', { method: 'POST', body: JSON.stringify(d) }),
  updateEvent: (id: number, d: any) =>
    req(`/dictionary/events/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteEvent: (id: number) => req(`/dictionary/events/${id}`, { method: 'DELETE' }),
  importMediaLibraryFile: (
    file: File,
    onUploadProgress?: (percent: number) => void,
  ): Promise<ImportStartResponse> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('file', file);
      xhr.open('POST', `${API_BASE}/dictionary/import`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        const response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) resolve(response);
        else reject(new Error(response.error || `HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    }),
  getImportProgress: (jobId: string) => req<unknown>(`/dictionary/import/${jobId}/progress`),
  getImportResult: (jobId: string) => req(`/dictionary/import/${jobId}/result`),

  importFile: (file: File): Promise<ImportStartResponse | unknown> =>
    dictionaryApi.importMediaLibraryFile(file),
  clearMediaLibrary: () => req('/dictionary/clear', { method: 'DELETE' }),

  mergeShortTags: () =>
    req<{
      shortsTagId: number;
      legacyShortTagId: number | null;
      moved: number;
      removedLegacyTag: boolean;
    }>('/videos/batch/merge-short-tags', { method: 'POST' }),
  tagShortsByDuration: () =>
    req<{ checked: number; eligible: number; tagged: number; alreadyTagged: number }>(
      '/videos/batch/tag-shorts-by-duration',
      { method: 'POST' },
    ),
  tagLongVideosByDuration: () =>
    req<{ checked: number; eligible: number; tagged: number; alreadyTagged: number }>(
      '/videos/batch/tag-long-videos-by-duration',
      { method: 'POST' },
    ),
  getGroup: (id: number | string) => req<DictionaryGroup>(`/dictionary/groups/${id}`),
  getGroupVideos: (id: number | string, page = 1, limit = 20) =>
    req<VideosResponse>(`/dictionary/groups/${id}/videos?page=${page}&limit=${limit}`),
  getArtist: (id: number | string) => req<DictionaryArtist>(`/dictionary/artists/${id}`),
  getArtistVideos: (id: number | string, page = 1, limit = 20) =>
    req<VideosResponse>(`/dictionary/artists/${id}/videos?page=${page}&limit=${limit}`),
  getSong: (id: number | string) => req<DictionarySong>(`/dictionary/songs/${id}`),
  getSongVideos: (id: number | string, page = 1, limit = 20) =>
    req<VideosResponse>(`/dictionary/songs/${id}/videos?page=${page}&limit=${limit}`),

  getArtistSongs: async (
    artistId: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedList<DictionarySong>> =>
    normalizePaginatedResponse(
      await req<LegacyOrPaginated<DictionarySong>>(
        `/dictionary/artists/${artistId}/songs${toQuery({ page, limit })}`,
      ),
      'songs',
      { page, limit },
    ),

  getGroupSongs: async (
    groupId: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedList<DictionarySong>> =>
    normalizePaginatedResponse(
      await req<LegacyOrPaginated<DictionarySong>>(
        `/dictionary/groups/${groupId}/songs${toQuery({ page, limit })}`,
      ),
      'songs',
      { page, limit },
    ),
  getAliases: (entityType: DictionaryAliasEntityType, entityId: number | string) =>
    req<DictionaryAlias[]>(`/dictionary/${entityType}/${entityId}/aliases`),
  addAlias: (entityType: DictionaryAliasEntityType, entityId: number | string, alias: string) =>
    req<DictionaryAlias>(`/dictionary/${entityType}/${entityId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias }),
    }),
  deleteAlias: (
    entityType: DictionaryAliasEntityType,
    entityId: number | string,
    aliasId: number,
  ) => req(`/dictionary/${entityType}/${entityId}/aliases/${aliasId}`, { method: 'DELETE' }),
};

export type { Video };
