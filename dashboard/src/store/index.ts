import { create } from 'zustand';
import type { Workspace, Tile, Platform, ContentItem } from '../types';

// Generate unique IDs
const uid = () => crypto.randomUUID();

// Default workspace with example tiles
const defaultWorkspace: Workspace = {
  id: uid(),
  name: 'My Feed',
  description: 'Default workspace',
  tiles: [
    {
      id: uid(),
      platform: 'reddit',
      config: { subreddit: 'technology', sort: 'hot', maxItems: 10 },
      position: { x: 0, y: 0, w: 4, h: 3 },
      refreshIntervalSecs: 300,
    },
    {
      id: uid(),
      platform: 'news',
      config: { newsQuery: 'technology', maxItems: 10 },
      position: { x: 4, y: 0, w: 4, h: 3 },
      refreshIntervalSecs: 600,
    },
    {
      id: uid(),
      platform: 'youtube',
      config: { query: 'programming tutorials', maxItems: 8 },
      position: { x: 8, y: 0, w: 4, h: 3 },
      refreshIntervalSecs: 900,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface WiredInState {
  // Workspaces
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  // Content cache
  tileContent: Record<string, ContentItem[]>; // tileId -> content
  tileLoading: Record<string, boolean>;

  // UI state
  sidebarOpen: boolean;
  addTileModalOpen: boolean;
  editingTileId: string | null;
  globalSearch: string;

  // Actions
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string, description: string) => void;
  removeWorkspace: (id: string) => void;

  addTile: (workspaceId: string, platform: Platform, config: Tile['config']) => void;
  updateTile: (tileId: string, updates: Partial<Tile>) => void;
  removeTile: (tileId: string) => void;
  updateTilePositions: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;

  setTileContent: (tileId: string, content: ContentItem[]) => void;
  setTileLoading: (tileId: string, loading: boolean) => void;

  toggleSidebar: () => void;
  setAddTileModalOpen: (open: boolean) => void;
  setEditingTileId: (id: string | null) => void;
  setGlobalSearch: (search: string) => void;
}

export const useWiredInStore = create<WiredInState>((set) => ({
  workspaces: [defaultWorkspace],
  activeWorkspaceId: defaultWorkspace.id,
  tileContent: {},
  tileLoading: {},
  sidebarOpen: true,
  addTileModalOpen: false,
  editingTileId: null,
  globalSearch: '',

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addWorkspace: (name, description) => {
    const workspace: Workspace = {
      id: uid(),
      name,
      description,
      tiles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ workspaces: [...s.workspaces, workspace], activeWorkspaceId: workspace.id }));
  },

  removeWorkspace: (id) =>
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? s.workspaces[0]?.id ?? null : s.activeWorkspaceId,
    })),

  addTile: (workspaceId, platform, config) => {
    const tile: Tile = {
      id: uid(),
      platform,
      config: { ...config, maxItems: config.maxItems ?? 10 },
      position: { x: 0, y: Infinity, w: 4, h: 3 },
      refreshIntervalSecs: 300,
    };
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, tiles: [...w.tiles, tile], updatedAt: new Date().toISOString() } : w
      ),
      addTileModalOpen: false,
    }));
  },

  updateTile: (tileId, updates) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tiles: w.tiles.map((t) => (t.id === tileId ? { ...t, ...updates } : t)),
      })),
    })),

  removeTile: (tileId) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tiles: w.tiles.filter((t) => t.id !== tileId),
      })),
    })),

  updateTilePositions: (layouts) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === s.activeWorkspaceId
          ? {
              ...w,
              tiles: w.tiles.map((t) => {
                const layout = layouts.find((l) => l.i === t.id);
                return layout ? { ...t, position: { x: layout.x, y: layout.y, w: layout.w, h: layout.h } } : t;
              }),
            }
          : w
      ),
    })),

  setTileContent: (tileId, content) =>
    set((s) => ({ tileContent: { ...s.tileContent, [tileId]: content } })),

  setTileLoading: (tileId, loading) =>
    set((s) => ({ tileLoading: { ...s.tileLoading, [tileId]: loading } })),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setAddTileModalOpen: (open) => set({ addTileModalOpen: open }),
  setEditingTileId: (id) => set({ editingTileId: id }),
  setGlobalSearch: (search) => set({ globalSearch: search }),
}));
