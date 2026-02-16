import { useEffect, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TileGrid from './components/TileGrid';
import AddTileModal from './components/AddTileModal';
import AuthScreen from './components/AuthScreen';
import OAuthCallback from './components/OAuthCallback';
import SharedView from './components/SharedView';
import BookmarksPanel from './components/BookmarksPanel';
import ToastContainer from './components/Toast';
import { useWiredInStore } from './store';
import { isAuthenticated } from './lib/api';
import { useSSE } from './hooks/useSSE';

type Route =
  | { type: 'app' }
  | { type: 'oauth-callback' }
  | { type: 'shared'; token: string };

function getRoute(): Route {
  const path = window.location.pathname;

  // OAuth callback: /oauth/callback or /oauth/{provider}/callback
  if (path.startsWith('/oauth/')) {
    return { type: 'oauth-callback' };
  }

  // Shared workspace: /shared/{token}
  const sharedMatch = path.match(/^\/shared\/([a-zA-Z0-9]+)$/);
  if (sharedMatch) {
    return { type: 'shared', token: sharedMatch[1] };
  }

  return { type: 'app' };
}

function App() {
  const [route] = useState<Route>(() => getRoute());
  const sidebarOpen = useWiredInStore((s) => s.sidebarOpen);
  const initialLoading = useWiredInStore((s) => s.initialLoading);
  const loadWorkspaces = useWiredInStore((s) => s.loadWorkspaces);
  const loadPreferences = useWiredInStore((s) => s.loadPreferences);
  const loadBookmarks = useWiredInStore((s) => s.loadBookmarks);
  const user = useWiredInStore((s) => s.user);
  const activeWorkspaceId = useWiredInStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (route.type === 'app' && isAuthenticated()) {
      loadWorkspaces();
      loadPreferences();
      loadBookmarks();
    } else if (route.type === 'app') {
      useWiredInStore.setState({ initialLoading: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useSSE(activeWorkspaceId);

  // Handle OAuth callback route
  if (route.type === 'oauth-callback') {
    return (
      <>
        <OAuthCallback />
        <ToastContainer />
      </>
    );
  }

  // Handle shared workspace route
  if (route.type === 'shared') {
    return (
      <>
        <SharedView token={route.token} />
        <ToastContainer />
      </>
    );
  }

  // Show auth screen if not authenticated
  if (!user && !isAuthenticated()) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
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
      <BookmarksPanel />
      <ToastContainer />
    </div>
  );
}

export default App;
