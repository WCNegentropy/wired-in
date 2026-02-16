import { useState, useEffect } from 'react';
import { X, Copy, Trash2, Link, Check } from 'lucide-react';
import { createShareLink, listShareLinks, revokeShareLink } from '../lib/api';
import type { ShareLink } from '../lib/api';
import { useWiredInStore } from '../store';

interface ShareModalProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

export default function ShareModal({ workspaceId, workspaceName, onClose }: ShareModalProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [expiresInHours, setExpiresInHours] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const addToast = useWiredInStore((s) => s.addToast);

  useEffect(() => {
    loadLinks();
  }, [workspaceId]);

  const loadLinks = async () => {
    try {
      const data = await listShareLinks(workspaceId);
      setLinks(data);
    } catch {
      // Share endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createShareLink(workspaceId, {
        permission,
        expiresInHours: expiresInHours > 0 ? expiresInHours : undefined,
      });
      await navigator.clipboard.writeText(result.shareUrl);
      addToast('Share link created and copied to clipboard', 'success');
      loadLinks();
    } catch (err) {
      addToast(
        `Failed to create share link: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeShareLink(workspaceId, shareId);
      setLinks((prev) => prev.filter((l) => l.id !== shareId));
      addToast('Share link revoked', 'success');
    } catch (err) {
      addToast(
        `Failed to revoke link: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Share "{workspaceName}"</h2>
          <button className="modal__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal__body">
          {/* Existing share links */}
          {links.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Active Links
              </div>
              <div className="share-modal__links">
                {links.map((link) => (
                  <div key={link.id} className="share-link-item">
                    <div className="share-link-item__info">
                      <div className="share-link-item__url">
                        {window.location.origin}/shared/{link.shareToken}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span className="share-link-item__badge">{link.permission}</span>
                        {link.expiresAt && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Expires {new Date(link.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="share-link-item__actions">
                      <button
                        className="tile-card__btn"
                        onClick={() => handleCopy(link.shareToken, link.id)}
                        title="Copy link"
                      >
                        {copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        className="tile-card__btn tile-card__btn--close"
                        onClick={() => handleRevoke(link.id)}
                        title="Revoke link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>}

          {/* Create new link */}
          <div className="share-form">
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Create New Link
            </div>
            <div className="share-form__row">
              <label>Permission</label>
              <select
                className="modal__select"
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                style={{ flex: 1 }}
              >
                <option value="view">View only</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <div className="share-form__row">
              <label>Expires in</label>
              <select
                className="modal__select"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value))}
                style={{ flex: 1 }}
              >
                <option value={0}>Never</option>
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
                <option value={720}>30 days</option>
              </select>
            </div>
            <button
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={creating}
              style={{ marginTop: '4px' }}
            >
              <Link size={14} />
              {creating ? 'Creating...' : 'Generate Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
