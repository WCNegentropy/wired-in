import { useState } from 'react';
import { useWiredInStore } from '../store';
import { Plus, Trash2, ChevronLeft, ChevronRight, LayoutDashboard, Share2 } from 'lucide-react';
import ShareModal from './ShareModal';

export default function Sidebar() {
  const {
    workspaces,
    activeWorkspaceId,
    sidebarOpen,
    setActiveWorkspace,
    addWorkspace,
    removeWorkspace,
    toggleSidebar,
  } = useWiredInStore();

  const [newName, setNewName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [shareWorkspaceId, setShareWorkspaceId] = useState<string | null>(null);

  const handleAddWorkspace = () => {
    if (newName.trim()) {
      addWorkspace(newName.trim(), '');
      setNewName('');
      setShowNewForm(false);
    }
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspace(id);
    // Auto-close sidebar on mobile
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  };

  const shareWorkspace = workspaces.find((w) => w.id === shareWorkspaceId);

  if (!sidebarOpen) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button className="sidebar__toggle" onClick={toggleSidebar} title="Expand sidebar">
          <ChevronRight size={18} />
        </button>
      </aside>
    );
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar__header">
          <div className="sidebar__title">
            <LayoutDashboard size={16} />
            <span>Workspaces</span>
          </div>
          <button className="sidebar__toggle" onClick={toggleSidebar} title="Collapse sidebar">
            <ChevronLeft size={18} />
          </button>
        </div>

        <ul className="sidebar__list">
          {workspaces.map((ws) => (
            <li
              key={ws.id}
              className={`sidebar__item ${ws.id === activeWorkspaceId ? 'sidebar__item--active' : ''}`}
              onClick={() => handleSelectWorkspace(ws.id)}
            >
              <div className="sidebar__item-info">
                <span className="sidebar__item-name">{ws.name}</span>
                <span className="sidebar__item-count">{ws.tiles.length} tiles</span>
              </div>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button
                  className="sidebar__item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareWorkspaceId(ws.id);
                  }}
                  title="Share workspace"
                  style={{ opacity: ws.id === activeWorkspaceId ? 0.6 : undefined }}
                >
                  <Share2 size={14} />
                </button>
                {workspaces.length > 1 && (
                  <button
                    className="sidebar__item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWorkspace(ws.id);
                    }}
                    title="Delete workspace"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {showNewForm ? (
          <div className="sidebar__new-form">
            <input
              className="sidebar__new-input"
              type="text"
              placeholder="Workspace name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddWorkspace()}
              autoFocus
            />
            <div className="sidebar__new-actions">
              <button className="btn btn--sm btn--primary" onClick={handleAddWorkspace}>
                Create
              </button>
              <button className="btn btn--sm btn--ghost" onClick={() => setShowNewForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="sidebar__add-btn" onClick={() => setShowNewForm(true)}>
            <Plus size={16} />
            <span>New Workspace</span>
          </button>
        )}
      </aside>

      {shareWorkspace && (
        <ShareModal
          workspaceId={shareWorkspace.id}
          workspaceName={shareWorkspace.name}
          onClose={() => setShareWorkspaceId(null)}
        />
      )}
    </>
  );
}
