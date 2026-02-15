import { useEffect, useState } from 'react';
import { Key, Trash2, ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
import * as api from '../lib/api';
import type { ApiKeyEntry } from '../lib/api';
import { useWiredInStore } from '../store';

const PLATFORMS = ['youtube', 'x', 'news'] as const;

export default function ApiKeySettings({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formPlatform, setFormPlatform] = useState<string>('youtube');
  const [formKeyName, setFormKeyName] = useState('default');
  const [formKeyValue, setFormKeyValue] = useState('');
  const [formKeySecret, setFormKeySecret] = useState('');
  const addToast = useWiredInStore((s) => s.addToast);

  const loadKeys = async () => {
    try {
      const result = await api.fetchApiKeys();
      setKeys(result);
    } catch {
      addToast('Failed to load API keys', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyValue.trim()) return;

    try {
      await api.createApiKey({
        platform: formPlatform,
        keyName: formKeyName || 'default',
        keyValue: formKeyValue,
        keySecret: formKeySecret || undefined,
      });
      addToast(`API key added for ${formPlatform}`, 'success');
      setShowForm(false);
      setFormKeyValue('');
      setFormKeySecret('');
      loadKeys();
    } catch (err) {
      addToast(
        `Failed to create API key: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  };

  const handleToggle = async (key: ApiKeyEntry) => {
    try {
      await api.updateApiKey(key.id, { isActive: !key.isActive });
      loadKeys();
    } catch {
      addToast('Failed to update API key', 'error');
    }
  };

  const handleDelete = async (key: ApiKeyEntry) => {
    try {
      await api.deleteApiKey(key.id);
      addToast(`API key deleted`, 'success');
      loadKeys();
    } catch {
      addToast('Failed to delete API key', 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">API Keys</h2>
          <button className="modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__subtitle">
            Configure API keys for platforms that require them (YouTube, X, News).
            Reddit and RSS work without API keys.
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              Loading...
            </div>
          ) : (
            <>
              <div className="api-key-settings__list">
                {keys.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No API keys configured yet.
                  </div>
                )}
                {keys.map((key) => (
                  <div key={key.id} className="api-key-card">
                    <div className="api-key-card__info">
                      <span className="api-key-card__platform">{key.platform}</span>
                      <span className="api-key-card__masked">
                        {key.keyName}: {key.keyValueMasked}
                        {!key.isActive && ' (disabled)'}
                      </span>
                    </div>
                    <div className="api-key-card__actions">
                      <button
                        className="tile-card__btn"
                        onClick={() => handleToggle(key)}
                        title={key.isActive ? 'Disable' : 'Enable'}
                      >
                        {key.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button
                        className="tile-card__btn tile-card__btn--close"
                        onClick={() => handleDelete(key)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {showForm ? (
                <form className="api-key-form" onSubmit={handleCreate}>
                  <div className="api-key-form__row">
                    <label className="modal__label">
                      Platform
                      <select
                        className="modal__select"
                        value={formPlatform}
                        onChange={(e) => setFormPlatform(e.target.value)}
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="modal__label">
                      Key Name
                      <input
                        className="modal__input"
                        value={formKeyName}
                        onChange={(e) => setFormKeyName(e.target.value)}
                        placeholder="default"
                      />
                    </label>
                  </div>
                  <label className="modal__label">
                    API Key
                    <input
                      className="modal__input"
                      type="password"
                      value={formKeyValue}
                      onChange={(e) => setFormKeyValue(e.target.value)}
                      placeholder="Paste your API key"
                      required
                    />
                  </label>
                  <label className="modal__label">
                    API Secret (optional, for X OAuth)
                    <input
                      className="modal__input"
                      type="password"
                      value={formKeySecret}
                      onChange={(e) => setFormKeySecret(e.target.value)}
                      placeholder="Optional secret"
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
                      Save Key
                    </button>
                    <button type="button" className="btn" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={() => setShowForm(true)}
                  style={{ width: '100%' }}
                >
                  <Plus size={16} />
                  Add API Key
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
