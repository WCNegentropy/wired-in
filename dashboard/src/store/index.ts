import { create } from 'zustand';
import type { Workspace, Tile, Platform, ContentItem } from '../types';
import * as api from '../lib/api';

interface WiredInState {
  // Workspaces
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  // Content cache
  tileContent: Record<string, ContentItem[]>;
  tileLoading: Record<string, boolean>;

  // UI state
  sidebarOpen: boolean;
  addTileModalOpen: boolean;
  editingTileId: string | null;
  globalSearch: string;

  // Loading
  initialLoading: boolean;

  // Auth
  user: { id: string; email: string; name?: string } | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string, description: string) => Promise<void>;
  removeWorkspace: (id: string) => Promise<void>;

  addTile: (workspaceId: string, platform: Platform, config: Tile['config']) => Promise<void>;
  updateTile: (tileId: string, updates: Partial<Tile>) => Promise<void>;
  removeTile: (tileId: string) => Promise<void>;
  updateTilePositions: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;

  setTileContent: (tileId: string, content: ContentItem[]) => void;
  setTileLoading: (tileId: string, loading: boolean) => void;

  toggleSidebar: () => void;
  setAddTileModalOpen: (open: boolean) => void;
  setEditingTileId: (id: string | null) => void;
  setGlobalSearch: (search: string) => void;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

export const useWiredInStore = create<WiredInState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  tileContent: {},
  tileLoading: {},
  sidebarOpen: true,
  addTileModalOpen: false,
  editingTileId: null,
  globalSearch: '',
  initialLoading: true,
  user: null,

  loadWorkspaces: async () => {
    try {
      const workspaces = await api.fetchWorkspaces();
      // Load tiles for each workspace
      const workspacesWithTiles = await Promise.all(
        workspaces.map(async (ws) => {
          try {
            const tiles = await api.fetchTiles(ws.id);
            return { ...ws, tiles };
          } catch {
            return { ...ws, tiles: ws.tiles || [] };
          }
        }),
      );
      set({
        workspaces: workspacesWithTiles,
        activeWorkspaceId: workspacesWithTiles[0]?.id ?? null,
        initialLoading: false,
      });
    } catch {
      set({ initialLoading: false });
    }
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addWorkspace: async (name, description) => {
    const workspace = await api.createWorkspace(name, description);
    set((s) => ({
      workspaces: [...s.workspaces, { ...workspace, tiles: workspace.tiles || [] }],
      activeWorkspaceId: workspace.id,
    }));
  },

  removeWorkspace: async (id) => {
    await api.deleteWorkspace(id);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? s.workspaces.find((w) => w.id !== id)?.id ?? null : s.activeWorkspaceId,
    }));
  },

  addTile: async (workspaceId, platform, config) => {
    const tile = await api.createTile(workspaceId, {
      platform,
      config: { ...config, maxItems: config.maxItems ?? 10 },
      position: { x: 0, y: 0, w: 4, h: 3 },
      refreshIntervalSecs: 300,
    });
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, tiles: [...w.tiles, tile], updatedAt: new Date().toISOString() } : w,
      ),
      addTileModalOpen: false,
    }));
  },

  updateTile: async (tileId, updates) => {
    const tile = await api.updateTile(tileId, updates);
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tiles: w.tiles.map((t) => (t.id === tileId ? { ...t, ...tile } : t)),
      })),
    }));
  },

  removeTile: async (tileId) => {
    await api.deleteTile(tileId);
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tiles: w.tiles.filter((t) => t.id !== tileId),
      })),
    }));
  },

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
          : w,
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

  // Auth actions
  login: async (email, password) => {
    const { user } = await api.loginUser(email, password);
    set({ user });
    await get().loadWorkspaces();
  },

  register: async (email, password, name?) => {
    const { user } = await api.registerUser(email, password, name);
    set({ user });
    await get().loadWorkspaces();
  },

  logout: () => {
    api.logout();
    set({ user: null, workspaces: [], activeWorkspaceId: null });
  },
}));
