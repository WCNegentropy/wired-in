import { useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TileGrid from './components/TileGrid';
import AddTileModal from './components/AddTileModal';
import AuthScreen from './components/AuthScreen';
import { useWiredInStore } from './store';
import { isAuthenticated } from './lib/api';
import { useSSE } from './hooks/useSSE';

function App() {
  const sidebarOpen = useWiredInStore((s) => s.sidebarOpen);
  const initialLoading = useWiredInStore((s) => s.initialLoading);
  const loadWorkspaces = useWiredInStore((s) => s.loadWorkspaces);
  const user = useWiredInStore((s) => s.user);
  const activeWorkspaceId = useWiredInStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (isAuthenticated()) {
      loadWorkspaces();
    } else {
      useWiredInStore.setState({ initialLoading: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useSSE(activeWorkspaceId);

  // Show auth screen if not authenticated
  if (!user && !isAuthenticated()) {
    return <AuthScreen />;
  }

  if (initialLoading) {
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
        Loading workspaces...
      </div>
    );
  }

  return (
    <div className={`app-shell ${sidebarOpen ? 'app-shell--sidebar-open' : ''}`}>
      <Header />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__main">
          <TileGrid />
        </main>
      </div>
      <AddTileModal />
    </div>
  );
}

export default App;
