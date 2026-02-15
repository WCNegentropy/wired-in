import { useWiredInStore } from '../store';
import { LogOut, Menu, Plus, Zap } from 'lucide-react';
import SearchBar from './SearchBar';

export default function Header() {
  const { sidebarOpen, toggleSidebar, setAddTileModalOpen, workspaces, activeWorkspaceId, user, logout } = useWiredInStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

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
        {user && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #888)', marginRight: '0.5rem' }}>
            {user.name || user.email}
          </span>
        )}
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
    </header>
  );
}
