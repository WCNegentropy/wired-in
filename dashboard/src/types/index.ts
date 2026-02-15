export interface Workspace {
  id: string;
  name: string;
  description: string;
  tiles: Tile[];
  createdAt: string;
  updatedAt: string;
}

export interface Tile {
  id: string;
  platform: Platform;
  config: TileConfig;
  position: TilePosition;
  refreshIntervalSecs: number;
}

export type Platform = 'reddit' | 'youtube' | 'x' | 'rss' | 'news';

export interface TilePosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileConfig {
  // Reddit
  subreddit?: string;
  sort?: 'hot' | 'new' | 'top' | 'rising';
  // YouTube
  channelId?: string;
  query?: string;
  // X
  xQuery?: string;
  xUser?: string;
  // RSS
  feedUrl?: string;
  // News
  newsQuery?: string;
  category?: string;
  country?: string;
  // Common
  maxItems?: number;
}

export interface ContentItem {
  id: string;
  platform: Platform;
  contentType: 'article' | 'video' | 'post' | 'comment';
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  author: string;
  authorUrl: string;
  score?: number;
  commentCount?: number;
  publishedAt: string;
  fetchedAt: string;
  metadata: Record<string, unknown>;
}
