import { useState } from 'react';
import { useWiredInStore } from '../store';
import { Zap } from 'lucide-react';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useWiredInStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: 'var(--bg-primary, #0a0a0f)',
                  border: '1px solid var(--border-color, #2a2a3a)',
                  borderRadius: '6px',
                  color: 'var(--text-primary, #e0e0e0)',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
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
              style={{
                width: '100%',
                padding: '0.6rem',
                background: 'var(--bg-primary, #0a0a0f)',
                border: '1px solid var(--border-color, #2a2a3a)',
                borderRadius: '6px',
                color: 'var(--text-primary, #e0e0e0)',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
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
              style={{
                width: '100%',
                padding: '0.6rem',
                background: 'var(--bg-primary, #0a0a0f)',
                border: '1px solid var(--border-color, #2a2a3a)',
                borderRadius: '6px',
                color: 'var(--text-primary, #e0e0e0)',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
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
      </div>
    </div>
  );
}
