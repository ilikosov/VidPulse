import type { Video, VideosResponse } from '../api';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';
const req = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: isFormData ? options?.headers : { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
};

export interface DictionaryGroup { id: number; name: string; type: string; active: boolean; artists?: Array<{ id: number; name: string; group_id: number }>; }
export interface DictionaryArtist { id: number; name: string; group_id: number; group_name: string | null; }
export interface DictionarySong { id: number; title: string; artist: string; }

export const dictionaryApi = {
  getGroups: () => req<any[]>('/dictionary/groups/list'), createGroup: (d: any) => req('/dictionary/groups', { method: 'POST', body: JSON.stringify(d) }), updateGroup: (id: number, d: any) => req(`/dictionary/groups/${id}`, { method: 'PUT', body: JSON.stringify(d) }), deleteGroup: (id: number) => req(`/dictionary/groups/${id}`, { method: 'DELETE' }),
  getArtists: (groupId?: number) => req<any[]>(`/dictionary/artists/list${groupId ? `?group_id=${groupId}` : ''}`), createArtist: (d: any) => req('/dictionary/artists', { method: 'POST', body: JSON.stringify(d) }), updateArtist: (id: number, d: any) => req(`/dictionary/artists/${id}`, { method: 'PUT', body: JSON.stringify(d) }), deleteArtist: (id: number) => req(`/dictionary/artists/${id}`, { method: 'DELETE' }),
  getSongs: () => req<any[]>('/dictionary/songs/list'), createSong: (d: any) => req('/dictionary/songs', { method: 'POST', body: JSON.stringify(d) }), updateSong: (id: number, d: any) => req(`/dictionary/songs/${id}`, { method: 'PUT', body: JSON.stringify(d) }), deleteSong: (id: number) => req(`/dictionary/songs/${id}`, { method: 'DELETE' }),
  getEvents: () => req<any[]>('/dictionary/events/list'), createEvent: (d: any) => req('/dictionary/events', { method: 'POST', body: JSON.stringify(d) }), updateEvent: (id: number, d: any) => req(`/dictionary/events/${id}`, { method: 'PUT', body: JSON.stringify(d) }), deleteEvent: (id: number) => req(`/dictionary/events/${id}`, { method: 'DELETE' }),
  importFile: (file: File) => { const fd = new FormData(); fd.append('file', file); return req('/dictionary/import', { method: 'POST', body: fd }); },
  getGroup: (id: number | string) => req<DictionaryGroup>(`/dictionary/groups/${id}`),
  getGroupVideos: (id: number | string, page = 1, limit = 20) => req<VideosResponse>(`/dictionary/groups/${id}/videos?page=${page}&limit=${limit}`),
  getArtist: (id: number | string) => req<DictionaryArtist>(`/dictionary/artists/${id}`),
  getArtistVideos: (id: number | string, page = 1, limit = 20) => req<VideosResponse>(`/dictionary/artists/${id}/videos?page=${page}&limit=${limit}`),
  getSong: (id: number | string) => req<DictionarySong>(`/dictionary/songs/${id}`),
  getSongVideos: (id: number | string, page = 1, limit = 20) => req<VideosResponse>(`/dictionary/songs/${id}/videos?page=${page}&limit=${limit}`),
};

export type { Video };
