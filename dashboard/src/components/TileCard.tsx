import { useEffect, useCallback } from 'react';
import { useWiredInStore } from '../store';
import { fetchFeed } from '../lib/api';
import { getMockContent } from '../lib/mockData';
import type { Tile, ContentItem, Platform } from '../types';
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

function ContentItemCard({ item }: { item: ContentItem }) {
  const meta = platformMeta[item.platform];

  return (
    <a
      className="content-item"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
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
  const { tileContent, tileLoading, setTileContent, setTileLoading, removeTile, setEditingTileId } = useWiredInStore();
  const content = tileContent[tile.id];
  const loading = tileLoading[tile.id] ?? false;
  const meta = platformMeta[tile.platform];
  const PlatformIcon = meta.icon;

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
        ) : content && content.length > 0 ? (
          <div className="tile-card__items">
            {content.map((item) => (
              <ContentItemCard key={item.id} item={item} />
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
