import { useState, useEffect } from 'react';
import { useWiredInStore } from '../store';
import { wasSessionExpired, clearSessionExpired, getExpiredTokenEmail, getOAuthUrl } from '../lib/api';
import { Zap, Github } from 'lucide-react';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const { login, register } = useWiredInStore();

  // Check for session expiry on mount
  useEffect(() => {
    if (wasSessionExpired()) {
      setSessionExpired(true);
      const expiredEmail = getExpiredTokenEmail();
      if (expiredEmail) {
        setEmail(expiredEmail);
      }
      clearSessionExpired();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSessionExpired(false);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    setError('');
    setSessionExpired(false);
    try {
      const url = await getOAuthUrl(provider);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : `${provider} login is not available`);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem',
    background: 'var(--bg-primary, #0a0a0f)',
    border: '1px solid var(--border-color, #2a2a3a)',
    borderRadius: '6px',
    color: 'var(--text-primary, #e0e0e0)',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  };

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

        {sessionExpired && (
          <div style={{
            padding: '0.6rem',
            marginBottom: '1rem',
            background: 'rgba(255, 170, 0, 0.1)',
            border: '1px solid rgba(255, 170, 0, 0.3)',
            borderRadius: '6px',
            color: '#ffaa00',
            fontSize: '0.85rem',
            textAlign: 'center',
          }}>
            Your session has expired. Please log in again.
          </div>
        )}

        <div style={{
          display: 'flex',
          marginBottom: '1.5rem',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #2a2a3a)',
        }}>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.6rem',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              background: mode === 'login' ? 'var(--accent-primary, #7c5cff)' : 'transparent',
              color: mode === 'login' ? '#fff' : 'var(--text-secondary, #888)',
            }}
          >
            Login
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1,
              padding: '0.6rem',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              background: mode === 'register' ? 'var(--accent-primary, #7c5cff)' : 'transparent',
              color: mode === 'register' ? '#fff' : 'var(--text-secondary, #888)',
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary, #888)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.6rem',
              marginBottom: '1rem',
              background: 'rgba(255, 69, 0, 0.1)',
              border: '1px solid rgba(255, 69, 0, 0.3)',
              borderRadius: '6px',
              color: '#ff4500',
              fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.7rem',
              background: 'var(--accent-primary, #7c5cff)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* OAuth Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          margin: '1.5rem 0',
          color: 'var(--text-secondary, #888)',
          fontSize: '0.8rem',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color, #2a2a3a)' }} />
          <span>or continue with</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color, #2a2a3a)' }} />
        </div>

        {/* OAuth Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleOAuth('github')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem',
              background: 'transparent',
              border: '1px solid var(--border-color, #2a2a3a)',
              borderRadius: '6px',
              color: 'var(--text-primary, #e0e0e0)',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <Github size={18} />
            GitHub
          </button>
          <button
            onClick={() => handleOAuth('google')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem',
              background: 'transparent',
              border: '1px solid var(--border-color, #2a2a3a)',
              borderRadius: '6px',
              color: 'var(--text-primary, #e0e0e0)',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
