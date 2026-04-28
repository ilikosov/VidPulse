import { google } from 'googleapis';
import { LRUCache } from 'lru-cache';
import type { VideoInfo, VideoDetails } from '../models/youtube.types';
import { logEvent } from './eventLog.service';

const youtube = google.youtube('v3');
const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  throw Error('YOUTUBE_API_KEY is not set in environment variables');
}

// LRU Cache configuration: max 500 entries, TTL 1 hour (3600000 ms)
const cache = new LRUCache<string, any>({
  max: 500,
  ttl: 3600000,
});

function getCacheKey(methodName: string, args: any[]): string {
  return `${methodName}:${JSON.stringify(args)}`;
}

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === 'key') {
      continue;
    }

    if (key === 'id' && Array.isArray(value)) {
      sanitized[key] = { count: value.length };
      continue;
    }

    if (Array.isArray(value) && value.length > 10) {
      sanitized[key] = { count: value.length };
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function getErrorCode(error: any): number | string | undefined {
  return error?.code ?? error?.status ?? error?.response?.status;
}

function isQuotaExceededError(error: any): boolean {
  const status = error?.response?.status ?? error?.code ?? error?.status;
  const reason =
    error?.errors?.[0]?.reason ??
    error?.response?.data?.error?.errors?.[0]?.reason ??
    error?.response?.data?.error?.status;

  return status === 403 && reason === 'quotaExceeded';
}

export class YouTubeService {
  private async logYouTubeCall(
    method: string,
    params: Record<string, unknown>,
    cacheHit: boolean,
  ): Promise<void> {
    if (process.env.LOG_YOUTUBE_API_CALLS !== 'true') {
      return;
    }

    await logEvent('youtube_api_call', `YouTube API call: ${method}`, {
      method,
      params: sanitizeParams(params),
      cacheHit,
    });
  }

  private async logYouTubeError(
    method: string,
    params: Record<string, unknown>,
    error: any,
  ): Promise<void> {
    const sanitizedParams = sanitizeParams(params);
    const description = `YouTube API error in ${method}: ${error?.message || 'Unknown error'}`;
    const errorCode = getErrorCode(error);

    if (isQuotaExceededError(error)) {
      await logEvent('youtube_quota_exceeded', description, {
        method,
        params: sanitizedParams,
        errorCode,
        error,
      });
      return;
    }

    await logEvent('youtube_api_error', description, {
      method,
      params: sanitizedParams,
      errorCode,
    });
  }

  private async executeYouTubeCall(
    method: string,
    params: Record<string, unknown>,
    call: () => Promise<any>,
  ): Promise<any> {
    try {
      const response = await call();
      await this.logYouTubeCall(method, params, false);
      return response;
    } catch (error) {
      await this.logYouTubeError(method, params, error);
      if (error && typeof error === 'object') {
        (error as any).__youtubeLogged = true;
      }
      throw error;
    }
  }

  /**
   * Extract channel ID from various YouTube URL formats
   * Supports: @username, channel/UC..., /c/name, direct IDs
   */
  async getChannelIdFromUrl(url: string): Promise<string> {
    const cacheKey = getCacheKey('getChannelIdFromUrl', [url]);
    const cached = cache.get(cacheKey);
    if (cached) {
      await this.logYouTubeCall('getChannelIdFromUrl', { url }, true);
      return cached;
    }

    try {
      let channelId: string | null = null;

      // Check if it's already a channel ID (starts with UC and is 24 chars)
      const channelIdMatch = url.match(/^UC[a-zA-Z0-9_-]{22}$/);
      if (channelIdMatch) {
        channelId = url;
      }

      // Handle @username format
      if (!channelId && url.includes('@')) {
        const usernameMatch = url.match(/@([a-zA-Z0-9_.-]+)/);
        if (usernameMatch) {
          const username = usernameMatch[1];
          const params = {
            key: apiKey!,
            forUsername: username,
            part: ['id'],
          };
          const response = await this.executeYouTubeCall('channels.list', params, () =>
            youtube.channels.list(params),
          );
          channelId = response.data.items?.[0]?.id || null;
        }
      }

      // Handle /channel/UC... format
      if (!channelId) {
        const channelPathMatch = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
        if (channelPathMatch) {
          channelId = channelPathMatch[1];
        }
      }

      // Handle /c/name format
      if (!channelId) {
        const cNameMatch = url.match(/\/c\/([a-zA-Z0-9_.-]+)/);
        if (cNameMatch) {
          const customName = cNameMatch[1];
          const params = {
            key: apiKey!,
            q: customName,
            type: 'channel',
            part: ['snippet'],
            maxResults: 1,
          };
          //@ts-ignore
          const response = await this.executeYouTubeCall('search.list', params, () =>
            //@ts-ignore
            youtube.search.list(params),
          );
          //@ts-ignore
          channelId = response.data.items?.[0]?.snippet?.channelId || null;
        }
      }

      // Handle /user/name format
      if (!channelId) {
        const userMatch = url.match(/\/user\/([a-zA-Z0-9_.-]+)/);
        if (userMatch) {
          const username = userMatch[1];
          const params = {
            key: apiKey!,
            forUsername: username,
            part: ['id'],
          };
          const response = await this.executeYouTubeCall('channels.list', params, () =>
            youtube.channels.list(params),
          );
          channelId = response.data.items?.[0]?.id || null;
        }
      }

      if (!channelId) {
        throw new Error(`Could not extract channel ID from URL: ${url}`);
      }

      cache.set(cacheKey, channelId);
      return channelId;
    } catch (error) {
      if (!(error as any)?.__youtubeLogged) {
        await this.logYouTubeError('getChannelIdFromUrl', { url }, error);
      }
      console.error('Error getting channel ID from URL:', error);
      throw error;
    }
  }

  /**
   * Fetch videos from a channel published after a specific date
   */
  async fetchChannelVideos(channelId: string, publishedAfter: string): Promise<VideoInfo[]> {
    const cacheKey = getCacheKey('fetchChannelVideos', [channelId, publishedAfter]);
    const cached = cache.get(cacheKey);
    if (cached) {
      await this.logYouTubeCall(
        'channels.list+playlistItems.list',
        { channelId, publishedAfter },
        true,
      );
      return cached;
    }

    try {
      // 1. Получаем ID плейлиста загрузок канала
      const channelParams = {
        key: apiKey!,
        id: [channelId],
        part: ['contentDetails'],
      };
      const channelResponse = await this.executeYouTubeCall('channels.list', channelParams, () =>
        youtube.channels.list(channelParams),
      );
      const uploadsPlaylistId =
        channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) throw new Error('Uploads playlist not found');

      // 2. Собираем все видео из этого плейлиста
      const videos: VideoInfo[] = [];
      let pageToken: string | undefined;
      const afterDate = new Date(publishedAfter).getTime();

      do {
        const playlistParams = {
          key: apiKey!,
          playlistId: uploadsPlaylistId,
          part: ['snippet'],
          maxResults: 50,
          pageToken,
        };
        const response = await this.executeYouTubeCall('playlistItems.list', playlistParams, () =>
          youtube.playlistItems.list(playlistParams),
        );

        const items = response.data.items || [];
        for (const item of items) {
          const snippet = item.snippet;
          if (snippet?.resourceId?.videoId) {
            const pubTime = new Date(snippet.publishedAt || '').getTime();
            if (pubTime >= afterDate) {
              videos.push({
                videoId: snippet.resourceId.videoId,
                title: snippet.title || '',
                publishedAt: snippet.publishedAt || '',
              });
            }
          }
        }
        pageToken = response.data.nextPageToken || undefined;
        // Досрочно выходим, если дошли до видео старше publishedAfter (список отсортирован от новых к старым)
        if (items.length > 0) {
          const oldestInPage = new Date(
            items[items.length - 1].snippet?.publishedAt || 0,
          ).getTime();
          if (oldestInPage < afterDate) break;
        }
      } while (pageToken);

      cache.set(cacheKey, videos);
      return videos;
    } catch (error) {
      if (!(error as any)?.__youtubeLogged) {
        await this.logYouTubeError('fetchChannelVideos', { channelId, publishedAfter }, error);
      }
      console.error('Error fetching channel videos:', error);
      throw error;
    }
  }
  /**
   * Fetch videos from a playlist with pagination support
   */
  async fetchPlaylistItems(playlistId: string): Promise<VideoInfo[]> {
    const cacheKey = getCacheKey('fetchPlaylistItems', [playlistId]);
    const cached = cache.get(cacheKey);
    if (cached) {
      await this.logYouTubeCall('playlistItems.list', { playlistId }, true);
      return cached;
    }

    try {
      const videos: VideoInfo[] = [];
      let pageToken: string | undefined;

      do {
        const params = {
          key: apiKey!,
          playlistId: playlistId,
          part: ['snippet'],
          maxResults: 50,
          pageToken,
        };
        const response = await this.executeYouTubeCall('playlistItems.list', params, () =>
          youtube.playlistItems.list(params),
        );

        const items = response.data.items || [];
        for (const item of items) {
          if (item.snippet?.resourceId?.videoId) {
            videos.push({
              videoId: item.snippet.resourceId.videoId,
              title: item.snippet.title || '',
              publishedAt: item.snippet.publishedAt || '',
            });
          }
        }

        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);

      cache.set(cacheKey, videos);
      return videos;
    } catch (error) {
      if (!(error as any)?.__youtubeLogged) {
        await this.logYouTubeError('fetchPlaylistItems', { playlistId }, error);
      }
      console.error('Error fetching playlist items:', error);
      throw error;
    }
  }

  /**
   * Extract playlist ID from YouTube playlist URL
   * Common format: https://www.youtube.com/playlist?list=PL...
   */
  getPlaylistIdFromUrl(url: string): string {
    const cacheKey = getCacheKey('getPlaylistIdFromUrl', [url]);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error(`Could not extract playlist ID from URL: ${url}`);
    }

    const playlistId = match[1];
    cache.set(cacheKey, playlistId);
    return playlistId;
  }

  /**
   * Fetch channel details including title and thumbnail
   */
  async getChannelDetails(channelId: string): Promise<{ title: string; thumbnail_url?: string }> {
    const cacheKey = getCacheKey('getChannelDetails', [channelId]);
    const cached = cache.get(cacheKey);
    if (cached) {
      await this.logYouTubeCall('channels.list', { id: [channelId], part: ['snippet'] }, true);
      return cached;
    }

    try {
      const params = {
        key: apiKey!,
        id: [channelId],
        part: ['snippet'],
      };
      const response = await this.executeYouTubeCall('channels.list', params, () =>
        youtube.channels.list(params),
      );

      const item = response.data.items?.[0];
      if (!item || !item.snippet) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const result = {
        title: item.snippet.title || 'Unknown Channel',
        thumbnail_url:
          item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || undefined,
      };

      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (!(error as any)?.__youtubeLogged) {
        await this.logYouTubeError('channels.list', { id: [channelId], part: ['snippet'] }, error);
      }
      console.error('Error getting channel details:', error);
      throw error;
    }
  }

  /**
   * Fetch playlist details including title
   */
  async getPlaylistDetails(playlistId: string): Promise<{ title: string }> {
    const cacheKey = getCacheKey('getPlaylistDetails', [playlistId]);
    const cached = cache.get(cacheKey);
    if (cached) {
      await this.logYouTubeCall('playlists.list', { id: [playlistId], part: ['snippet'] }, true);
      return cached;
    }

    try {
      const params = {
        key: apiKey!,
        id: [playlistId],
        part: ['snippet'],
      };
      const response = await this.executeYouTubeCall('playlists.list', params, () =>
        youtube.playlists.list(params),
      );

      const item = response.data.items?.[0];
      if (!item || !item.snippet) {
        throw new Error(`Playlist not found: ${playlistId}`);
      }

      const result = {
        title: item.snippet.title || 'Unknown Playlist',
      };

      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (!(error as any)?.__youtubeLogged) {
        await this.logYouTubeError(
          'playlists.list',
          { id: [playlistId], part: ['snippet'] },
          error,
        );
      }
      console.error('Error getting playlist details:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a video
   */
  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const cacheKey = getCacheKey('getVideoDetails', [videoId]);
    const cached = cache.get(cacheKey);
    if (cached) {
      await this.logYouTubeCall(
        'videos.list',
        {
          id: [videoId],
          part: ['snippet'],
          fields: 'items(snippet(title,channelId,publishedAt,thumbnails,tags))',
        },
        true,
      );
      return cached;
    }

    try {
      const params = {
        key: apiKey!,
        id: [videoId],
        part: ['snippet'],
        fields: 'items(snippet(title,channelId,publishedAt,thumbnails,tags))',
      };
      const response = await this.executeYouTubeCall('videos.list', params, () =>
        youtube.videos.list(params),
      );

      const item = response.data.items?.[0];
      if (!item || !item.snippet) {
        throw new Error(`Video not found: ${videoId}`);
      }

      const result: VideoDetails = {
        title: item.snippet.title || '',
        channelId: item.snippet.channelId || '',
        publishedAt: item.snippet.publishedAt || '',
        thumbnails: item.snippet.thumbnails,
        tags: item.snippet.tags ?? [],
      };

      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (!(error as any)?.__youtubeLogged) {
        await this.logYouTubeError(
          'videos.list',
          {
            id: [videoId],
            part: ['snippet'],
            fields: 'items(snippet(title,channelId,publishedAt,thumbnails,tags))',
          },
          error,
        );
      }
      console.error('Error getting video details:', error);
      throw error;
    }
  }
}

// Export singleton instance for sharing across modules
export const youtubeService = new YouTubeService();
