import { useState } from 'react';
import { useWiredInStore } from '../store';
import { Plus, Trash2, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';

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

  const handleAddWorkspace = () => {
    if (newName.trim()) {
      addWorkspace(newName.trim(), '');
      setNewName('');
      setShowNewForm(false);
    }
  };

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
            onClick={() => setActiveWorkspace(ws.id)}
          >
            <div className="sidebar__item-info">
              <span className="sidebar__item-name">{ws.name}</span>
              <span className="sidebar__item-count">{ws.tiles.length} tiles</span>
            </div>
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
  );
}
