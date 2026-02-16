import { useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useWiredInStore } from '../store';
import TileCard from './TileCard';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function TileGrid() {
  const { workspaces, activeWorkspaceId, updateTilePositions } = useWiredInStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const layouts = useMemo(() => {
    if (!activeWorkspace) return { lg: [], md: [], sm: [], xs: [] };
    const lg = activeWorkspace.tiles.map((t) => ({
      i: t.id,
      x: t.position.x,
      y: t.position.y,
      w: t.position.w,
      h: t.position.h,
      minW: 2,
      minH: 2,
    }));
    const md = activeWorkspace.tiles.map((t) => ({
      i: t.id,
      x: t.position.x % 8,
      y: t.position.y,
      w: Math.min(t.position.w, 8),
      h: t.position.h,
      minW: 2,
      minH: 2,
    }));
    const sm = activeWorkspace.tiles.map((t) => ({
      i: t.id,
      x: 0,
      y: t.position.y,
      w: 4,
      h: t.position.h,
      minW: 2,
      minH: 2,
    }));
    const xs = activeWorkspace.tiles.map((t, idx) => ({
      i: t.id,
      x: 0,
      y: idx * 3,
      w: 2,
      h: 3,
      minW: 1,
      minH: 2,
    }));
    return { lg, md, sm, xs };
  }, [activeWorkspace]);

  const handleLayoutChange = (_current: LayoutItem[], allLayouts: Record<string, LayoutItem[]>) => {
    const lgLayout = allLayouts.lg;
    if (lgLayout) {
      updateTilePositions(lgLayout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="tile-grid tile-grid--empty">
        <p>No workspace selected. Create one to get started.</p>
      </div>
    );
  }

  if (activeWorkspace.tiles.length === 0) {
    return (
      <div className="tile-grid tile-grid--empty">
        <div className="tile-grid__empty-state">
          <h2>No tiles yet</h2>
          <p>Click "Add Tile" to start building your feed dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tile-grid">
      <ResponsiveGridLayout
        className="tile-grid__layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 900, sm: 600, xs: 480 }}
        cols={{ lg: 12, md: 8, sm: 4, xs: 2 }}
        rowHeight={120}
        draggableHandle=".tile-card__header"
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        margin={[12, 12]}
      >
        {activeWorkspace.tiles.map((tile) => (
          <div key={tile.id}>
            <TileCard tile={tile} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
