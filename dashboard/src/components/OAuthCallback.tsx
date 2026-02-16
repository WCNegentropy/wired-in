import { useEffect, useState } from 'react';
import { handleOAuthCallback } from '../lib/api';
import { useWiredInStore } from '../store';
import { Zap, AlertCircle } from 'lucide-react';

export default function OAuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // Determine provider from the URL path or state
    const pathParts = window.location.pathname.split('/');
    const callbackIdx = pathParts.indexOf('oauth');
    const provider = callbackIdx >= 0 ? pathParts[callbackIdx + 1] : 'github';

    if (!code || !state) {
      setError('Missing authorization code or state parameter. Please try again.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { user } = await handleOAuthCallback(provider, code, state);
        useWiredInStore.setState({ user });

        // Redirect to dashboard
        window.location.href = '/';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OAuth authentication failed');
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-primary, #0a0a0f)',
      color: 'var(--text-primary, #e0e0e0)',
      fontFamily: 'monospace',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        background: 'var(--bg-secondary, #141420)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #2a2a3a)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}>
          <Zap size={28} style={{ color: 'var(--accent-primary, #7c5cff)' }} />
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Wired-In</h1>
        </div>

        {loading && !error && (
          <div>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-color, #2a2a3a)',
              borderTopColor: 'var(--accent-primary, #7c5cff)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <p style={{ color: 'var(--text-secondary, #888)' }}>
              Completing sign in...
            </p>
          </div>
        )}

        {error && (
          <div>
            <AlertCircle size={32} style={{ color: '#ff4500', marginBottom: '1rem' }} />
            <div style={{
              padding: '0.6rem',
              marginBottom: '1.5rem',
              background: 'rgba(255, 69, 0, 0.1)',
              border: '1px solid rgba(255, 69, 0, 0.3)',
              borderRadius: '6px',
              color: '#ff4500',
              fontSize: '0.85rem',
            }}>
              {error}
            </div>
            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.6rem 1.5rem',
                background: 'var(--accent-primary, #7c5cff)',
                borderRadius: '6px',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '0.9rem',
              }}
            >
              Try Again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
