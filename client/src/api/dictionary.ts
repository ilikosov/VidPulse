import { apiUrl, createXhrError, fetchApi, parseXhrResponse } from './client';
import type {
  DictionaryAlias,
  DictionaryAliasEntityType,
  DictionaryAliasRequest,
  DictionaryArtist,
  DictionaryArtistRequest,
  DictionaryEvent,
  DictionaryEventRequest,
  DictionaryGroup,
  DictionaryGroupRequest,
  DictionaryGroupType,
  DictionarySong,
  DictionarySongRequest,
  GroupsListParams,
  ArtistsListParams,
  ImportStartResponse,
  ListParams,
  PaginatedList,
  Pagination,
  Video,
  VideosResponse,
} from './types';

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
      await fetchApi<LegacyOrPaginated<DictionaryGroup>>(
        `/dictionary/groups/list${toQuery(params)}`,
      ),
      'groups',
      params,
    ),
  getArtistsList: async (params: ArtistsListParams): Promise<PaginatedList<DictionaryArtist>> =>
    normalizePaginatedResponse(
      await fetchApi<LegacyOrPaginated<DictionaryArtist>>(
        `/dictionary/artists/list${toQuery(params)}`,
      ),
      'artists',
      params,
    ),
  getSongsList: async (params: ListParams): Promise<PaginatedList<DictionarySong>> =>
    normalizePaginatedResponse(
      await fetchApi<LegacyOrPaginated<DictionarySong>>(`/dictionary/songs/list${toQuery(params)}`),
      'songs',
      params,
    ),
  getEventsList: async (params: ListParams): Promise<PaginatedList<{ id: number; name: string }>> =>
    normalizePaginatedResponse(
      await fetchApi<LegacyOrPaginated<{ id: number; name: string }>>(
        `/dictionary/events/list${toQuery(params)}`,
      ),
      'events',
      params,
    ),
  getGroups: async () => (await dictionaryApi.getGroupsList({ page: 1, limit: 1000 })).items,
  createGroup: (d: DictionaryGroupRequest) =>
    fetchApi('/dictionary/groups', { method: 'POST', body: JSON.stringify(d) }),
  updateGroup: (id: number, d: DictionaryGroupRequest) =>
    fetchApi(`/dictionary/groups/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteGroup: (id: number) => fetchApi(`/dictionary/groups/${id}`, { method: 'DELETE' }),
  getArtists: async (groupId?: number) =>
    (await dictionaryApi.getArtistsList({ page: 1, limit: 1000, group_id: groupId })).items,
  createArtist: (d: DictionaryArtistRequest) =>
    fetchApi('/dictionary/artists', { method: 'POST', body: JSON.stringify(d) }),
  updateArtist: (id: number, d: DictionaryArtistRequest) =>
    fetchApi(`/dictionary/artists/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteArtist: (id: number) => fetchApi(`/dictionary/artists/${id}`, { method: 'DELETE' }),
  getSongs: async () => (await dictionaryApi.getSongsList({ page: 1, limit: 1000 })).items,
  createSong: (d: DictionarySongRequest) =>
    fetchApi('/dictionary/songs', { method: 'POST', body: JSON.stringify(d) }),
  updateSong: (id: number, d: DictionarySongRequest) =>
    fetchApi(`/dictionary/songs/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteSong: (id: number) => fetchApi(`/dictionary/songs/${id}`, { method: 'DELETE' }),
  getEvents: async () => (await dictionaryApi.getEventsList({ page: 1, limit: 1000 })).items,
  getEvent: (id: number | string) =>
    fetchApi<{ id: number; name: string }>(`/dictionary/events/${id}`),
  getEventVideos: (id: number | string, page = 1, limit = 20) =>
    fetchApi<VideosResponse>(`/dictionary/events/${id}/videos?page=${page}&limit=${limit}`),
  createEvent: (d: DictionaryEventRequest) =>
    fetchApi('/dictionary/events', { method: 'POST', body: JSON.stringify(d) }),
  updateEvent: (id: number, d: DictionaryEventRequest) =>
    fetchApi(`/dictionary/events/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteEvent: (id: number) => fetchApi(`/dictionary/events/${id}`, { method: 'DELETE' }),
  importMediaLibraryFile: (
    file: File,
    onUploadProgress?: (percent: number) => void,
  ): Promise<ImportStartResponse> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('file', file);
      xhr.open('POST', apiUrl('/dictionary/import'));
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        const response = parseXhrResponse<ImportStartResponse>(xhr);
        if (xhr.status >= 200 && xhr.status < 300) resolve(response);
        else reject(createXhrError(xhr));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    }),
  getImportProgress: (jobId: string) => fetchApi<unknown>(`/dictionary/import/${jobId}/progress`),
  getImportResult: (jobId: string) => fetchApi(`/dictionary/import/${jobId}/result`),

  importFile: (file: File): Promise<ImportStartResponse | unknown> =>
    dictionaryApi.importMediaLibraryFile(file),
  clearMediaLibrary: () => fetchApi('/dictionary/clear', { method: 'DELETE' }),

  mergeShortTags: () =>
    fetchApi<{
      shortsTagId: number;
      legacyShortTagId: number | null;
      moved: number;
      removedLegacyTag: boolean;
    }>('/videos/batch/merge-short-tags', { method: 'POST' }),
  tagShortsByDuration: () =>
    fetchApi<{ checked: number; eligible: number; tagged: number; alreadyTagged: number }>(
      '/videos/batch/tag-shorts-by-duration',
      { method: 'POST' },
    ),
  tagLongVideosByDuration: () =>
    fetchApi<{ checked: number; eligible: number; tagged: number; alreadyTagged: number }>(
      '/videos/batch/tag-long-videos-by-duration',
      { method: 'POST' },
    ),
  getGroup: (id: number | string) => fetchApi<DictionaryGroup>(`/dictionary/groups/${id}`),
  getGroupVideos: (id: number | string, page = 1, limit = 20) =>
    fetchApi<VideosResponse>(`/dictionary/groups/${id}/videos?page=${page}&limit=${limit}`),
  getArtist: (id: number | string) => fetchApi<DictionaryArtist>(`/dictionary/artists/${id}`),
  getArtistVideos: (id: number | string, page = 1, limit = 20) =>
    fetchApi<VideosResponse>(`/dictionary/artists/${id}/videos?page=${page}&limit=${limit}`),
  getSong: (id: number | string) => fetchApi<DictionarySong>(`/dictionary/songs/${id}`),
  getSongVideos: (id: number | string, page = 1, limit = 20) =>
    fetchApi<VideosResponse>(`/dictionary/songs/${id}/videos?page=${page}&limit=${limit}`),

  getArtistSongs: async (
    artistId: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedList<DictionarySong>> =>
    normalizePaginatedResponse(
      await fetchApi<LegacyOrPaginated<DictionarySong>>(
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
      await fetchApi<LegacyOrPaginated<DictionarySong>>(
        `/dictionary/groups/${groupId}/songs${toQuery({ page, limit })}`,
      ),
      'songs',
      { page, limit },
    ),
  getAliases: (entityType: DictionaryAliasEntityType, entityId: number | string) =>
    fetchApi<DictionaryAlias[]>(`/dictionary/${entityType}/${entityId}/aliases`),
  addAlias: (entityType: DictionaryAliasEntityType, entityId: number | string, alias: string) =>
    fetchApi<DictionaryAlias>(`/dictionary/${entityType}/${entityId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias } satisfies DictionaryAliasRequest),
    }),
  deleteAlias: (
    entityType: DictionaryAliasEntityType,
    entityId: number | string,
    aliasId: number,
  ) => fetchApi(`/dictionary/${entityType}/${entityId}/aliases/${aliasId}`, { method: 'DELETE' }),
};

export type {
  DictionaryAlias,
  DictionaryAliasEntityType,
  DictionaryArtist,
  DictionaryEvent,
  DictionaryGroup,
  DictionaryGroupType,
  DictionarySong,
  ImportStartResponse,
  PaginatedList,
  Video,
};
