import { useEffect, useCallback, useMemo } from 'react';
import { useWiredInStore } from '../store';
import { fetchFeed, trackClick } from '../lib/api';
import { getMockContent } from '../lib/mockData';
import type { Tile, ContentItem, Platform, TileFilters } from '../types';
import {
  RefreshCw,
  Settings,
  X,
  MessageSquare,
  ArrowUp,
  ExternalLink,
  Newspaper,
  Youtube,
  Rss,
  Twitter,
  Globe,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';

const platformMeta: Record<Platform, { label: string; color: string; icon: typeof Newspaper }> = {
  reddit: { label: 'Reddit', color: '#ff4500', icon: MessageSquare },
  youtube: { label: 'YouTube', color: '#ff0000', icon: Youtube },
  x: { label: 'X', color: '#1d9bf0', icon: Twitter },
  rss: { label: 'RSS', color: '#ee802f', icon: Rss },
  news: { label: 'News', color: '#8b8b8b', icon: Newspaper },
};

function tileSubtitle(tile: Tile): string {
  const c = tile.config;
  if (tile.platform === 'reddit') return `r/${c.subreddit ?? 'all'} - ${c.sort ?? 'hot'}`;
  if (tile.platform === 'youtube') return c.query ?? c.channelId ?? 'trending';
  if (tile.platform === 'x') return c.xUser ? `@${c.xUser}` : c.xQuery ?? 'trending';
  if (tile.platform === 'rss') return c.feedUrl ?? 'feed';
  if (tile.platform === 'news') return c.newsQuery ?? c.category ?? 'top stories';
  return '';
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNumber(n: number | undefined): string {
  if (n === undefined) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Client-side content filtering (Track C)
// ---------------------------------------------------------------------------

function applyFilters(items: ContentItem[], filters: TileFilters | undefined): ContentItem[] {
  if (!filters) return items;

  return items.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();

    // Keyword include filter
    if (filters.keywords && filters.keywords.length > 0) {
      const hasMatch = filters.keywords.some((kw) => text.includes(kw.toLowerCase()));
      if (!hasMatch) return false;
    }

    // Keyword exclude filter
    if (filters.keywordsExclude && filters.keywordsExclude.length > 0) {
      const hasExcluded = filters.keywordsExclude.some((kw) => text.includes(kw.toLowerCase()));
      if (hasExcluded) return false;
    }

    // Regex filter
    if (filters.regex) {
      try {
        const re = new RegExp(filters.regex, 'i');
        if (!re.test(`${item.title} ${item.description}`)) return false;
      } catch {
        // Invalid regex, skip filter
      }
    }

    // NSFW filter
    if (filters.nsfwFilter === 'hide' && item.nsfw) return false;

    // Min score filter
    if (filters.minScore !== undefined && (item.score ?? 0) < filters.minScore) return false;

    // Min comments filter
    if (filters.minComments !== undefined && (item.commentCount ?? 0) < filters.minComments) return false;

    // Max age filter
    if (filters.maxAge !== undefined) {
      const ageMs = Date.now() - new Date(item.publishedAt).getTime();
      if (ageMs > filters.maxAge * 1000) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Content item card with click tracking
// ---------------------------------------------------------------------------

function ContentItemCard({ item, tileId, workspaceId }: { item: ContentItem; tileId: string; workspaceId: string | null }) {
  const meta = platformMeta[item.platform];
  const { addBookmark, removeBookmark, bookmarkedContentIds, bookmarks } = useWiredInStore();
  const isBookmarked = bookmarkedContentIds.has(item.id);
  const nsfwBlur = item.nsfw;

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBookmarked) {
      const bookmark = bookmarks.find((b) => b.contentId === item.id);
      if (bookmark) removeBookmark(bookmark.id);
    } else {
      addBookmark({
        contentId: item.id,
        platform: item.platform,
        title: item.title,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl || undefined,
        author: item.author || undefined,
      });
    }
  };

  const handleClick = () => {
    // Fire-and-forget click tracking
    if (workspaceId) {
      trackClick({
        workspaceId,
        tileId,
        contentId: item.id,
        platform: item.platform,
        title: item.title,
        url: item.url,
      }).catch(() => {});
    }
  };

  return (
    <a
      className={`content-item${nsfwBlur ? ' content-item--nsfw-blur' : ''}`}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      {item.thumbnailUrl && (
        <div className="content-item__thumb">
          <img src={item.thumbnailUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="content-item__body">
        <h4 className="content-item__title">{item.title}</h4>
        {item.description && (
          <p className="content-item__desc">{item.description.slice(0, 120)}{item.description.length > 120 ? '...' : ''}</p>
        )}
        <div className="content-item__meta">
          <span className="content-item__author" style={{ color: meta.color }}>{item.author}</span>
          <span className="content-item__time">{formatTime(item.publishedAt)}</span>
          {item.score !== undefined && (
            <span className="content-item__score">
              <ArrowUp size={12} /> {formatNumber(item.score)}
            </span>
          )}
          {item.commentCount !== undefined && (
            <span className="content-item__comments">
              <MessageSquare size={12} /> {formatNumber(item.commentCount)}
            </span>
          )}
          {item.metadata?.crossPostedFrom && Array.isArray(item.metadata.crossPostedFrom) && item.metadata.crossPostedFrom.length > 0 && (
            <span className="cross-platform-badge">
              Also on {(item.metadata.crossPostedFrom as string[]).join(', ')}
            </span>
          )}
          <button
            className="content-item__bookmark"
            onClick={handleBookmarkToggle}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {isBookmarked ? (
              <BookmarkCheck size={13} style={{ color: 'var(--accent-blue)' }} />
            ) : (
              <Bookmark size={13} />
            )}
          </button>
          <ExternalLink size={12} className="content-item__link-icon" />
        </div>
      </div>
    </a>
  );
}

function LoadingSkeleton() {
  return (
    <div className="tile-card__skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--desc" />
          <div className="skeleton-line skeleton-line--meta" />
        </div>
      ))}
    </div>
  );
}

interface TileCardProps {
  tile: Tile;
}

export default function TileCard({ tile }: TileCardProps) {
  const { tileContent, tileLoading, setTileContent, setTileLoading, removeTile, setEditingTileId, activeWorkspaceId } = useWiredInStore();
  const content = tileContent[tile.id];
  const loading = tileLoading[tile.id] ?? false;
  const meta = platformMeta[tile.platform];
  const PlatformIcon = meta.icon;

  // Apply client-side filters
  const filteredContent = useMemo(
    () => applyFilters(content ?? [], tile.config.filters),
    [content, tile.config.filters],
  );

  const loadContent = useCallback(async () => {
    setTileLoading(tile.id, true);
    try {
      const items = await fetchFeed(tile.platform, tile.config as Record<string, string>);
      const contentItems = (items as ContentItem[]).slice(0, tile.config.maxItems ?? 10);
      if (contentItems.length > 0) {
        setTileContent(tile.id, contentItems);
      } else {
        // Fall back to mock data if API returns empty
        setTileContent(tile.id, getMockContent(tile));
      }
    } catch {
      // Fall back to mock data on error
      setTileContent(tile.id, getMockContent(tile));
    } finally {
      setTileLoading(tile.id, false);
    }
  }, [tile.id, tile.platform, tile.config, setTileContent, setTileLoading]);

  // Load live data on mount
  useEffect(() => {
    if (!content) {
      loadContent();
    }
  }, [tile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh timer
  useEffect(() => {
    if (tile.refreshIntervalSecs <= 0) return;
    const interval = setInterval(() => {
      loadContent();
    }, tile.refreshIntervalSecs * 1000);
    return () => clearInterval(interval);
  }, [tile.refreshIntervalSecs, loadContent]);

  const handleRefresh = () => {
    loadContent();
  };

  return (
    <div className="tile-card" style={{ '--platform-color': meta.color } as React.CSSProperties}>
      <div className="tile-card__header">
        <div className="tile-card__header-left">
          <PlatformIcon size={16} style={{ color: meta.color }} />
          <span className="tile-card__platform" style={{ color: meta.color }}>{meta.label}</span>
          <span className="tile-card__subtitle">{tileSubtitle(tile)}</span>
        </div>
        <div className="tile-card__header-right">
          <button className="tile-card__btn" onClick={handleRefresh} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="tile-card__btn" onClick={() => setEditingTileId(tile.id)} title="Settings">
            <Settings size={14} />
          </button>
          <button className="tile-card__btn tile-card__btn--close" onClick={() => removeTile(tile.id)} title="Remove tile">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="tile-card__content">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredContent.length > 0 ? (
          <div className="tile-card__items">
            {filteredContent.map((item) => (
              <ContentItemCard key={item.id} item={item} tileId={tile.id} workspaceId={activeWorkspaceId} />
            ))}
          </div>
        ) : (
          <div className="tile-card__empty">
            <Globe size={32} />
            <p>No content available</p>
          </div>
        )}
      </div>
    </div>
  );
}
