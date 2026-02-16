import { useState, useEffect } from 'react';
import { useWiredInStore } from '../store';
import { Search, Bell, BellOff, Trash2, Plus, X } from 'lucide-react';

const PLATFORM_OPTIONS = [
  { value: 'reddit', label: 'Reddit' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'rss', label: 'RSS' },
  { value: 'news', label: 'News' },
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SavedSearchesModal() {
  const {
    savedSearches,
    savedSearchesModalOpen,
    setSavedSearchesModalOpen,
    loadSavedSearches,
    addSavedSearch,
    removeSavedSearch,
  } = useWiredInStore();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [notify, setNotify] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (savedSearchesModalOpen) {
      loadSavedSearches();
    }
  }, [savedSearchesModalOpen, loadSavedSearches]);

  if (!savedSearchesModalOpen) return null;

  const handleClose = () => {
    setSavedSearchesModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setName('');
    setQuery('');
    setPlatforms([]);
    setNotify(false);
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !query.trim()) return;
    setSubmitting(true);
    try {
      await addSavedSearch({
        name: name.trim(),
        query: query.trim(),
        platforms: platforms.length > 0 ? platforms : undefined,
        notify,
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await removeSavedSearch(id);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            <Search size={18} />
            Saved Searches
          </h2>
          <button className="modal__close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body">
          {/* Saved searches list */}
          {savedSearches.length === 0 && !showForm ? (
            <div className="saved-search-empty">
              <Search size={32} />
              <p>No saved searches yet</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Create a saved search to monitor topics across platforms.
              </p>
            </div>
          ) : (
            <div className="saved-search-list">
              {savedSearches.map((search) => (
                <div key={search.id} className="saved-search-item">
                  <div className="saved-search-item__body">
                    <div className="saved-search-item__name">{search.name}</div>
                    <div className="saved-search-item__query">
                      <Search size={12} />
                      {search.query}
                    </div>
                    <div className="saved-search-item__meta">
                      {search.platforms.length > 0 && (
                        <span className="saved-search-item__platforms">
                          {search.platforms.join(', ')}
                        </span>
                      )}
                      <span className="saved-search-item__date">
                        {formatDate(search.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="saved-search-item__actions">
                    <span
                      className="saved-search-item__notify-badge"
                      title={search.notify ? 'Notifications on' : 'Notifications off'}
                    >
                      {search.notify ? <Bell size={14} /> : <BellOff size={14} />}
                    </span>
                    <button
                      className="tile-card__btn tile-card__btn--close"
                      onClick={() => handleDelete(search.id)}
                      title="Delete saved search"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add search form */}
          {showForm ? (
            <div className="saved-search-form">
              <div className="saved-search-form__title">New Saved Search</div>

              <label className="modal__label">
                Name
                <input
                  className="modal__input"
                  type="text"
                  placeholder="e.g. AI News Tracker"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="modal__label">
                Query
                <input
                  className="modal__input"
                  type="text"
                  placeholder="e.g. artificial intelligence"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>

              <div className="modal__label">
                Platforms
                <div className="saved-search-form__platforms">
                  {PLATFORM_OPTIONS.map((opt) => (
                    <label key={opt.value} className="saved-search-form__checkbox">
                      <input
                        type="checkbox"
                        checked={platforms.includes(opt.value)}
                        onChange={() => togglePlatform(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="saved-search-form__notify">
                <span className="saved-search-form__notify-label">
                  {notify ? <Bell size={14} /> : <BellOff size={14} />}
                  Notifications
                </span>
                <button
                  type="button"
                  className={`saved-search-form__toggle ${notify ? 'saved-search-form__toggle--on' : ''}`}
                  onClick={() => setNotify((prev) => !prev)}
                  aria-label="Toggle notifications"
                >
                  <span className="saved-search-form__toggle-knob" />
                </button>
              </div>

              <div className="saved-search-form__actions">
                <button
                  className="btn btn--ghost"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleSubmit}
                  disabled={!name.trim() || !query.trim() || submitting}
                >
                  {submitting ? 'Saving...' : 'Save Search'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn--primary saved-search-add-btn"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} />
              Add Search
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
