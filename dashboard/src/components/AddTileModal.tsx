import { useState } from 'react';
import { useWiredInStore } from '../store';
import type { Platform, TileConfig } from '../types';
import {
  X,
  MessageSquare,
  Youtube,
  Twitter,
  Rss,
  Newspaper,
} from 'lucide-react';

const platformOptions: Array<{ platform: Platform; label: string; icon: typeof Newspaper; color: string }> = [
  { platform: 'reddit', label: 'Reddit', icon: MessageSquare, color: '#ff4500' },
  { platform: 'youtube', label: 'YouTube', icon: Youtube, color: '#ff0000' },
  { platform: 'x', label: 'X (Twitter)', icon: Twitter, color: '#1d9bf0' },
  { platform: 'rss', label: 'RSS Feed', icon: Rss, color: '#ee802f' },
  { platform: 'news', label: 'News', icon: Newspaper, color: '#8b8b8b' },
];

const NEWS_CATEGORIES = [
  'general', 'business', 'entertainment', 'health', 'science', 'sports', 'technology',
];

const NEWS_COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'in', name: 'India' },
  { code: 'jp', name: 'Japan' },
];

export default function AddTileModal() {
  const { addTileModalOpen, setAddTileModalOpen, activeWorkspaceId, addTile } = useWiredInStore();

  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [config, setConfig] = useState<TileConfig>({});

  if (!addTileModalOpen) return null;

  const handleClose = () => {
    setAddTileModalOpen(false);
    setSelectedPlatform(null);
    setConfig({});
  };

  const handleSubmit = () => {
    if (!selectedPlatform || !activeWorkspaceId) return;
    addTile(activeWorkspaceId, selectedPlatform, config);
    setSelectedPlatform(null);
    setConfig({});
  };

  const updateConfig = (patch: Partial<TileConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const renderConfigForm = () => {
    if (!selectedPlatform) return null;

    switch (selectedPlatform) {
      case 'reddit':
        return (
          <div className="modal__form">
            <label className="modal__label">
              Subreddit
              <input
                className="modal__input"
                type="text"
                placeholder="e.g. technology"
                value={config.subreddit ?? ''}
                onChange={(e) => updateConfig({ subreddit: e.target.value })}
              />
            </label>
            <label className="modal__label">
              Sort
              <select
                className="modal__select"
                value={config.sort ?? 'hot'}
                onChange={(e) => updateConfig({ sort: e.target.value as TileConfig['sort'] })}
              >
                <option value="hot">Hot</option>
                <option value="new">New</option>
                <option value="top">Top</option>
                <option value="rising">Rising</option>
              </select>
            </label>
            <label className="modal__label">
              Max Items
              <input
                className="modal__input"
                type="number"
                min={1}
                max={50}
                value={config.maxItems ?? 10}
                onChange={(e) => updateConfig({ maxItems: Number(e.target.value) })}
              />
            </label>
          </div>
        );
      case 'youtube':
        return (
          <div className="modal__form">
            <label className="modal__label">
              Search Query
              <input
                className="modal__input"
                type="text"
                placeholder="e.g. programming tutorials"
                value={config.query ?? ''}
                onChange={(e) => updateConfig({ query: e.target.value })}
              />
            </label>
            <label className="modal__label">
              Channel ID (optional)
              <input
                className="modal__input"
                type="text"
                placeholder="e.g. UCvjgXvBlUQFABawJGAKJBUg"
                value={config.channelId ?? ''}
                onChange={(e) => updateConfig({ channelId: e.target.value })}
              />
            </label>
            <label className="modal__label">
              Max Items
              <input
                className="modal__input"
                type="number"
                min={1}
                max={50}
                value={config.maxItems ?? 8}
                onChange={(e) => updateConfig({ maxItems: Number(e.target.value) })}
              />
            </label>
          </div>
        );
      case 'x':
        return (
          <div className="modal__form">
            <label className="modal__label">
              Search Query
              <input
                className="modal__input"
                type="text"
                placeholder="e.g. #typescript"
                value={config.xQuery ?? ''}
                onChange={(e) => updateConfig({ xQuery: e.target.value })}
              />
            </label>
            <label className="modal__label">
              User Handle (optional)
              <input
                className="modal__input"
                type="text"
                placeholder="e.g. elonmusk"
                value={config.xUser ?? ''}
                onChange={(e) => updateConfig({ xUser: e.target.value })}
              />
            </label>
            <label className="modal__label">
              Max Items
              <input
                className="modal__input"
                type="number"
                min={1}
                max={50}
                value={config.maxItems ?? 10}
                onChange={(e) => updateConfig({ maxItems: Number(e.target.value) })}
              />
            </label>
          </div>
        );
      case 'rss':
        return (
          <div className="modal__form">
            <label className="modal__label">
              Feed URL
              <input
                className="modal__input"
                type="url"
                placeholder="e.g. https://blog.example.com/rss"
                value={config.feedUrl ?? ''}
                onChange={(e) => updateConfig({ feedUrl: e.target.value })}
              />
            </label>
            <label className="modal__label">
              Max Items
              <input
                className="modal__input"
                type="number"
                min={1}
                max={50}
                value={config.maxItems ?? 10}
                onChange={(e) => updateConfig({ maxItems: Number(e.target.value) })}
              />
            </label>
          </div>
        );
      case 'news':
        return (
          <div className="modal__form">
            <label className="modal__label">
              Search Query
              <input
                className="modal__input"
                type="text"
                placeholder="e.g. artificial intelligence"
                value={config.newsQuery ?? ''}
                onChange={(e) => updateConfig({ newsQuery: e.target.value })}
              />
            </label>
            <label className="modal__label">
              Category
              <select
                className="modal__select"
                value={config.category ?? ''}
                onChange={(e) => updateConfig({ category: e.target.value })}
              >
                <option value="">Any</option>
                {NEWS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="modal__label">
              Country
              <select
                className="modal__select"
                value={config.country ?? ''}
                onChange={(e) => updateConfig({ country: e.target.value })}
              >
                <option value="">Any</option>
                {NEWS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="modal__label">
              Max Items
              <input
                className="modal__input"
                type="number"
                min={1}
                max={50}
                value={config.maxItems ?? 10}
                onChange={(e) => updateConfig({ maxItems: Number(e.target.value) })}
              />
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Add Tile</h2>
          <button className="modal__close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body">
          {!selectedPlatform ? (
            <>
              <p className="modal__subtitle">Choose a platform</p>
              <div className="modal__platforms">
                {platformOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.platform}
                      className="modal__platform-btn"
                      onClick={() => setSelectedPlatform(opt.platform)}
                      style={{ '--btn-color': opt.color } as React.CSSProperties}
                    >
                      <Icon size={28} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <button className="modal__back" onClick={() => setSelectedPlatform(null)}>
                &larr; Back to platforms
              </button>
              <h3 className="modal__config-title">
                Configure {platformOptions.find((p) => p.platform === selectedPlatform)?.label} Tile
              </h3>
              {renderConfigForm()}
              <button className="btn btn--primary modal__submit" onClick={handleSubmit}>
                Add Tile
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
