import { useEffect, useState } from 'react';
import { fetchSharedWorkspace } from '../lib/api';
import type { Workspace } from '../types';
import { Zap, Eye, AlertCircle } from 'lucide-react';
import TileCard from './TileCard';

interface SharedData {
  workspace: Workspace;
  owner: string;
}

export default function SharedView({ token }: { token: string }) {
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchSharedWorkspace(token);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared workspace');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary, #0a0a0f)',
        color: 'var(--text-primary, #e0e0e0)',
        fontFamily: 'monospace',
        fontSize: '1.2rem',
      }}>
        Loading shared workspace...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary, #0a0a0f)',
        color: 'var(--text-primary, #e0e0e0)',
        fontFamily: 'monospace',
        gap: '1rem',
      }}>
        <AlertCircle size={48} style={{ color: '#ff4500' }} />
        <h2>Workspace Not Found</h2>
        <p style={{ color: 'var(--text-secondary, #888)' }}>
          {error || 'This shared link may have expired or been revoked.'}
        </p>
        <a
          href="/"
          style={{
            padding: '0.6rem 1.5rem',
            background: 'var(--accent-primary, #7c5cff)',
            borderRadius: '6px',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          Go to Wired-In
        </a>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header__left">
          <div className="header__brand">
            <Zap size={22} className="header__logo-icon" />
            <h1 className="header__title">Wired-In</h1>
          </div>
          <span className="header__workspace-name">{data.workspace.name}</span>
        </div>
        <div className="header__right" />
      </header>

      <div className="shared-view__banner">
        <Eye size={16} />
        <span>Shared by <strong>{data.owner}</strong> &mdash; View Only</span>
      </div>

      <main className="app-shell__main" style={{ flex: 1, overflow: 'auto' }}>
        <div className="tile-grid">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '12px',
            padding: '16px',
          }}>
            {data.workspace.tiles.map((tile) => (
              <div key={tile.id} style={{ minHeight: '300px' }}>
                <TileCard tile={tile} />
              </div>
            ))}
          </div>
          {data.workspace.tiles.length === 0 && (
            <div className="tile-grid tile-grid--empty">
              <p>This workspace has no tiles.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
