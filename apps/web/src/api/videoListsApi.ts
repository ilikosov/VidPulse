import { fetchApi } from './client';
import type {
  CreateVideoListRequest,
  RenameVideoListRequest,
  VideoListBatchOperationRequest,
  VideoListDetails,
  VideoListOperationResponse,
  VideoListSummary,
  VideoListVideosRequest,
} from './types';

export type {
  CreateVideoListRequest,
  RenameVideoListRequest,
  VideoListDetails,
  VideoListOperationResponse,
  VideoListSummary,
  VideoListVideo,
  VideoListVideosRequest,
} from './types';

export const getVideoLists = (): Promise<VideoListSummary[]> =>
  fetchApi<VideoListSummary[]>('/video-lists');

export const getListDetails = (id: number | string): Promise<VideoListDetails> =>
  fetchApi<VideoListDetails>(`/video-lists/${id}`);

export const createVideoList = (data: CreateVideoListRequest): Promise<VideoListSummary> =>
  fetchApi<VideoListSummary>('/video-lists', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const addVideosToList = (
  id: number | string,
  videoIds: number[],
): Promise<VideoListOperationResponse> => {
  const payload: VideoListVideosRequest = { videoIds };
  return fetchApi<VideoListOperationResponse>(`/video-lists/${id}/videos`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const removeVideosFromList = (
  id: number | string,
  videoIds: number[],
): Promise<VideoListOperationResponse> => {
  const payload: VideoListVideosRequest = { videoIds };
  return fetchApi<VideoListOperationResponse>(`/video-lists/${id}/videos`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
};

export const renameVideoList = (id: number | string, name: string): Promise<{ ok: boolean }> => {
  const payload: RenameVideoListRequest = { name };
  return fetchApi<{ ok: boolean }>(`/video-lists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteVideoList = (id: number | string): Promise<{ ok: boolean }> =>
  fetchApi<{ ok: boolean }>(`/video-lists/${id}`, { method: 'DELETE' });

export const batchVideoOperation = (
  id: number | string,
  operation: string,
  videoIds: number[],
): Promise<VideoListOperationResponse> => {
  const payload: VideoListBatchOperationRequest = { operation, videoIds };
  return fetchApi<VideoListOperationResponse>(`/video-lists/${id}/batch`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
