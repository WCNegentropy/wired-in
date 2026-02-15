import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TileGrid from './components/TileGrid';
import AddTileModal from './components/AddTileModal';
import { useWiredInStore } from './store';

function App() {
  const sidebarOpen = useWiredInStore((s) => s.sidebarOpen);

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
