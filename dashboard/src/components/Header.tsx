import { useState } from 'react';
import { useWiredInStore } from '../store';
import { LogOut, Menu, Plus, Zap, Sun, Moon, Key, Columns2 } from 'lucide-react';
import SearchBar from './SearchBar';
import ApiKeySettings from './ApiKeySettings';

function ConnectionStatus() {
  const connectionStatus = useWiredInStore((s) => s.connectionStatus);

  const labels: Record<string, string> = {
    connected: 'Live',
    connecting: 'Connecting...',
    disconnected: 'Offline',
  };

  return (
    <div className="connection-status" title={`SSE: ${connectionStatus}`}>
      <span className={`connection-dot connection-dot--${connectionStatus}`} />
      <span>{labels[connectionStatus]}</span>
    </div>
  );
}

export default function Header() {
  const { sidebarOpen, toggleSidebar, setAddTileModalOpen, workspaces, activeWorkspaceId, user, logout, preferences, updatePreferences } = useWiredInStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const [showSettings, setShowSettings] = useState(false);

  const toggleTheme = () => {
    const newTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: newTheme });
  };

  const toggleCompactMode = () => {
    updatePreferences({ compactMode: !preferences.compactMode });
  };

  return (
    <header className="header">
      <div className="header__left">
        {!sidebarOpen && (
          <button className="header__menu-btn" onClick={toggleSidebar} title="Open sidebar">
            <Menu size={20} />
          </button>
        )}
        <div className="header__brand">
          <Zap size={22} className="header__logo-icon" />
          <h1 className="header__title">Wired-In</h1>
        </div>
        {activeWorkspace && (
          <span className="header__workspace-name">{activeWorkspace.name}</span>
        )}
      </div>

      <div className="header__center">
        <SearchBar />
      </div>

      <div className="header__right">
        <ConnectionStatus />
        {user && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)', marginRight: '0.5rem' }}>
            {user.name || user.email}
          </span>
        )}
        <button
          className="header__menu-btn"
          onClick={toggleTheme}
          title={preferences.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {preferences.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="header__menu-btn"
          onClick={toggleCompactMode}
          title={preferences.compactMode ? 'Disable compact mode' : 'Enable compact mode'}
          style={{ marginLeft: '4px' }}
        >
          <Columns2 size={18} />
        </button>
        <button
          className="header__menu-btn"
          onClick={() => setShowSettings(true)}
          title="API Key Settings"
          style={{ marginLeft: '4px' }}
        >
          <Key size={18} />
        </button>
        <button className="btn btn--primary header__add-btn" onClick={() => setAddTileModalOpen(true)}>
          <Plus size={16} />
          <span>Add Tile</span>
        </button>
        <button
          className="header__menu-btn"
          onClick={logout}
          title="Logout"
          style={{ marginLeft: '0.5rem' }}
        >
          <LogOut size={18} />
        </button>
      </div>
      {showSettings && <ApiKeySettings onClose={() => setShowSettings(false)} />}
    </header>
  );
}
