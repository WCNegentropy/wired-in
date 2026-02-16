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
  workspaceId?: string;
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
  // Filters (Track C)
  filters?: TileFilters;
}

export interface TileFilters {
  keywords?: string[];
  keywordsExclude?: string[];
  regex?: string;
  nsfwFilter?: 'hide' | 'blur' | 'show';
  minScore?: number;
  minComments?: number;
  maxAge?: number; // seconds
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
  nsfw?: boolean;
  publishedAt: string;
  fetchedAt: string;
  metadata: Record<string, unknown>;
}

// Saved Searches (Track A)
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  platforms: string[];
  notify: boolean;
  createdAt: string;
}

// Analytics (Track B)
export interface WorkspaceAnalytics {
  workspaceId: string;
  totalClicks: number;
  platformBreakdown: Array<{ platform: string; count: number; percentage: number }>;
  topContent: Array<{ contentId: string; title?: string; url: string; platform: string; clickCount: number }>;
  dailyClicks: Array<{ day: string; count: number }>;
  periodStart: string;
  periodEnd: string;
}

// Import/Export (Track D)
export interface WorkspaceExport {
  version: string;
  exportedAt: string;
  workspaces: Array<{
    name: string;
    description?: string;
    tiles: Array<{
      platform: Platform;
      config: TileConfig;
      position: TilePosition;
      refreshIntervalSecs: number;
    }>;
  }>;
}
