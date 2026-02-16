import { useState, useEffect, useMemo } from 'react';
import { useWiredInStore } from '../store';
import { X, Bookmark, ExternalLink, Trash2, Search, Download } from 'lucide-react';
import type { Bookmark as BookmarkType } from '../lib/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const platformColors: Record<string, string> = {
  reddit: '#ff4500',
  youtube: '#ff0000',
  x: '#1d9bf0',
  rss: '#ee802f',
  news: '#8b8b8b',
};

function BookmarkItem({ bookmark, onDelete }: { bookmark: BookmarkType; onDelete: (id: string) => void }) {
  return (
    <div className="bookmark-item">
      <div className="bookmark-item__body">
        <a
          className="bookmark-item__title"
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {bookmark.title}
        </a>
        <div className="bookmark-item__meta">
          <span style={{ color: platformColors[bookmark.platform] || 'var(--text-muted)' }}>
            {bookmark.platform}
          </span>
          {bookmark.author && <span>{bookmark.author}</span>}
          <span>{formatDate(bookmark.createdAt)}</span>
        </div>
        {bookmark.notes && (
          <div className="bookmark-item__notes">{bookmark.notes}</div>
        )}
      </div>
      <div className="bookmark-item__actions">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="tile-card__btn"
          title="Open"
        >
          <ExternalLink size={14} />
        </a>
        <button
          className="tile-card__btn tile-card__btn--close"
          onClick={() => onDelete(bookmark.id)}
          title="Remove bookmark"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function BookmarksPanel() {
  const { bookmarks, bookmarksPanelOpen, setBookmarksPanelOpen, loadBookmarks, removeBookmark } = useWiredInStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (bookmarksPanelOpen) {
      loadBookmarks();
    }
  }, [bookmarksPanelOpen, loadBookmarks]);

  const grouped = useMemo(() => {
    const filtered = search
      ? bookmarks.filter(
          (b) =>
            b.title.toLowerCase().includes(search.toLowerCase()) ||
            b.author?.toLowerCase().includes(search.toLowerCase()) ||
            b.notes?.toLowerCase().includes(search.toLowerCase()),
        )
      : bookmarks;

    const groups: Record<string, BookmarkType[]> = {};
    for (const b of filtered) {
      const key = b.platform;
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return groups;
  }, [bookmarks, search]);

  const handleExport = () => {
    const data = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wired-in-bookmarks.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!bookmarksPanelOpen) return null;

  return (
    <>
      <div className="bookmarks-panel-overlay" onClick={() => setBookmarksPanelOpen(false)} />
      <div className="bookmarks-panel">
        <div className="bookmarks-panel__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bookmark size={18} />
            <span className="bookmarks-panel__title">Bookmarks</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({bookmarks.length})
            </span>
          </div>
          <button className="modal__close" onClick={() => setBookmarksPanelOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="bookmarks-panel__search">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
          </div>
        </div>

        <div className="bookmarks-panel__content">
          {Object.keys(grouped).length === 0 ? (
            <div className="bookmarks-panel__empty">
              <Bookmark size={32} />
              <p>{search ? 'No matching bookmarks' : 'No bookmarks yet'}</p>
              <p style={{ fontSize: '0.8rem' }}>
                Click the bookmark icon on any content item to save it here.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([platform, items]) => (
              <div key={platform}>
                <div className="bookmarks-panel__group-title" style={{ color: platformColors[platform] }}>
                  {platform} ({items.length})
                </div>
                {items.map((b) => (
                  <BookmarkItem key={b.id} bookmark={b} onDelete={removeBookmark} />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="bookmarks-panel__footer">
          <button
            className="btn btn--sm btn--ghost"
            onClick={handleExport}
            disabled={bookmarks.length === 0}
            style={{ width: '100%' }}
          >
            <Download size={14} /> Export as JSON
          </button>
        </div>
      </div>
    </>
  );
}
