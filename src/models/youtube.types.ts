// YouTube API types

export interface VideoInfo {
  videoId: string;
  title: string;
  publishedAt: string;
}

export interface VideoDetails {
  title: string;
  channelId: string;
  publishedAt: string;
  thumbnails: any;
  tags?: string[];
}

export interface ChannelInfo {
  channelId: string;
  title?: string;
}
