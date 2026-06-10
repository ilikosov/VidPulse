import { fetchApi } from './client';
import type { FileRecord, FilesResponse, LinkFileRequest, ScanResult } from './types';

export type { FileRecord, FilesResponse, ScanResult } from './types';

export const getFiles = (params?: {
  page?: number;
  limit?: number;
  videoId?: number;
}): Promise<FilesResponse> => {
  const query = new URLSearchParams();
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.videoId != null) query.set('videoId', String(params.videoId));
  const qs = query.toString();
  return fetchApi<FilesResponse>(`/files${qs ? `?${qs}` : ''}`);
};

export const scanFiles = (): Promise<ScanResult> =>
  fetchApi<ScanResult>('/files/scan', { method: 'POST' });

export const linkFileToVideo = (fileId: number, videoId: number | null): Promise<FileRecord> => {
  const payload: LinkFileRequest = { videoId };
  return fetchApi<FileRecord>(`/files/${fileId}/link`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const deleteFile = (fileId: number): Promise<{ ok: boolean }> =>
  fetchApi<{ ok: boolean }>(`/files/${fileId}`, { method: 'DELETE' });
