import { useState } from 'react';
import { useWiredInStore } from '../store';
import { LogOut, Menu, Plus, Zap, Sun, Moon, Key, Columns2, MoreVertical, Bookmark } from 'lucide-react';
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
  const [showOverflow, setShowOverflow] = useState(false);
  const setBookmarksPanelOpen = useWiredInStore((s) => s.setBookmarksPanelOpen);

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
          <span className="header__user-name">
            {user.name || user.email}
          </span>
        )}
        <div className="header__actions">
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
          >
            <Columns2 size={18} />
          </button>
          <button
            className="header__menu-btn"
            onClick={() => setBookmarksPanelOpen(true)}
            title="Bookmarks"
          >
            <Bookmark size={18} />
          </button>
          <button
            className="header__menu-btn"
            onClick={() => setShowSettings(true)}
            title="API Key Settings"
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
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Mobile overflow menu */}
        <div className="header__overflow">
          <button
            className="header__menu-btn"
            onClick={() => setShowOverflow(!showOverflow)}
            title="More options"
          >
            <MoreVertical size={18} />
          </button>
          {showOverflow && (
            <>
              <div className="header__overflow-backdrop" onClick={() => setShowOverflow(false)} />
              <div className="header__overflow-menu">
                <button onClick={() => { setAddTileModalOpen(true); setShowOverflow(false); }}>
                  <Plus size={16} /> Add Tile
                </button>
                <button onClick={() => { setBookmarksPanelOpen(true); setShowOverflow(false); }}>
                  <Bookmark size={16} /> Bookmarks
                </button>
                <button onClick={() => { toggleTheme(); setShowOverflow(false); }}>
                  {preferences.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {preferences.theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                </button>
                <button onClick={() => { toggleCompactMode(); setShowOverflow(false); }}>
                  <Columns2 size={16} /> Compact Mode
                </button>
                <button onClick={() => { setShowSettings(true); setShowOverflow(false); }}>
                  <Key size={16} /> API Keys
                </button>
                <button onClick={() => { logout(); setShowOverflow(false); }}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showSettings && <ApiKeySettings onClose={() => setShowSettings(false)} />}
    </header>
  );
}
