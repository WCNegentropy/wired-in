import { useWiredInStore } from '../store';
import { Menu, Plus, Zap } from 'lucide-react';
import SearchBar from './SearchBar';

export default function Header() {
  const { sidebarOpen, toggleSidebar, setAddTileModalOpen, workspaces, activeWorkspaceId } = useWiredInStore();
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
        <button className="btn btn--primary header__add-btn" onClick={() => setAddTileModalOpen(true)}>
          <Plus size={16} />
          <span>Add Tile</span>
        </button>
      </div>
    </header>
  );
}
