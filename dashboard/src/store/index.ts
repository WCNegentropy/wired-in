import { create } from 'zustand';
import type { Workspace, Tile, Platform, ContentItem, WorkspaceAnalytics } from '../types';
import type { ToastData } from '../components/Toast';
import type { UserPreferences } from '../lib/api';
import * as api from '../lib/api';

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

let positionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

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

  // Toasts
  toasts: ToastData[];

  // Preferences
  preferences: UserPreferences;

  // SSE connection status
  connectionStatus: 'connecting' | 'connected' | 'disconnected';

  // Bookmarks
  bookmarks: api.Bookmark[];
  bookmarksPanelOpen: boolean;
  bookmarkedContentIds: Set<string>;

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

  // Toast actions
  addToast: (message: string, type: ToastData['type']) => void;
  removeToast: (id: string) => void;

  // Preferences actions
  loadPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;

  // Connection status
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected') => void;

  // Bookmark actions
  loadBookmarks: () => Promise<void>;
  addBookmark: (data: { contentId: string; platform: string; title: string; url: string; thumbnailUrl?: string; author?: string }) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  setBookmarksPanelOpen: (open: boolean) => void;
  isBookmarked: (contentId: string) => boolean;

  // Saved Searches (Track A)
  savedSearches: api.SavedSearchEntry[];
  savedSearchesModalOpen: boolean;
  setSavedSearchesModalOpen: (open: boolean) => void;
  loadSavedSearches: () => Promise<void>;
  addSavedSearch: (data: { name: string; query: string; platforms?: string[]; notify?: boolean }) => Promise<void>;
  removeSavedSearch: (id: string) => Promise<void>;
  notifications: Array<{ id: string; searchName: string; title: string; url: string; platform: string; timestamp: string }>;
  notificationCount: number;

  // Analytics (Track B)
  analyticsData: WorkspaceAnalytics | null;
  analyticsPanelOpen: boolean;
  setAnalyticsPanelOpen: (open: boolean) => void;
  loadAnalytics: (workspaceId: string, period?: '7' | '30' | 'all') => Promise<void>;

  // Import/Export (Track D)
  importExportModalOpen: boolean;
  setImportExportModalOpen: (open: boolean) => void;
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
  toasts: [],
  preferences: {
    theme: 'dark',
    defaultRefreshInterval: 300,
    notificationsEnabled: true,
    compactMode: false,
  },
  connectionStatus: 'disconnected',
  bookmarks: [],
  bookmarksPanelOpen: false,
  bookmarkedContentIds: new Set<string>(),

  loadWorkspaces: async () => {
    try {
      const workspaces = await api.fetchWorkspaces();
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
    } catch (err) {
      set({ initialLoading: false });
      get().addToast(
        `Failed to load workspaces: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addWorkspace: async (name, description) => {
    try {
      const workspace = await api.createWorkspace(name, description);
      set((s) => ({
        workspaces: [...s.workspaces, { ...workspace, tiles: workspace.tiles || [] }],
        activeWorkspaceId: workspace.id,
      }));
      get().addToast(`Workspace "${name}" created`, 'success');
    } catch (err) {
      get().addToast(
        `Failed to create workspace: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      throw err;
    }
  },

  removeWorkspace: async (id) => {
    try {
      await api.deleteWorkspace(id);
      set((s) => ({
        workspaces: s.workspaces.filter((w) => w.id !== id),
        activeWorkspaceId: s.activeWorkspaceId === id ? s.workspaces.find((w) => w.id !== id)?.id ?? null : s.activeWorkspaceId,
      }));
      get().addToast('Workspace deleted', 'success');
    } catch (err) {
      get().addToast(
        `Failed to delete workspace: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      throw err;
    }
  },

  addTile: async (workspaceId, platform, config) => {
    try {
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
    } catch (err) {
      get().addToast(
        `Failed to add tile: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      throw err;
    }
  },

  updateTile: async (tileId, updates) => {
    try {
      const tile = await api.updateTile(tileId, updates);
      set((s) => ({
        workspaces: s.workspaces.map((w) => ({
          ...w,
          tiles: w.tiles.map((t) => (t.id === tileId ? { ...t, ...tile } : t)),
        })),
      }));
    } catch (err) {
      get().addToast(
        `Failed to update tile: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      throw err;
    }
  },

  removeTile: async (tileId) => {
    try {
      await api.deleteTile(tileId);
      set((s) => ({
        workspaces: s.workspaces.map((w) => ({
          ...w,
          tiles: w.tiles.filter((t) => t.id !== tileId),
        })),
      }));
    } catch (err) {
      get().addToast(
        `Failed to remove tile: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      throw err;
    }
  },

  updateTilePositions: (layouts) => {
    // Update local state immediately
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
    }));

    // Debounce API persistence (2 seconds)
    if (positionDebounceTimer) {
      clearTimeout(positionDebounceTimer);
    }
    positionDebounceTimer = setTimeout(() => {
      const state = get();
      const workspaceId = state.activeWorkspaceId;
      if (!workspaceId) return;

      const workspace = state.workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return;

      const positions = workspace.tiles.map((t) => ({
        tileId: t.id,
        x: t.position.x,
        y: t.position.y,
        w: t.position.w,
        h: t.position.h,
      }));

      api.batchUpdateTilePositions(workspaceId, positions).catch((err) => {
        state.addToast(
          `Failed to save tile positions: ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        );
      });
    }, 2000);
  },

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
    get().loadPreferences();
  },

  register: async (email, password, name?) => {
    const { user } = await api.registerUser(email, password, name);
    set({ user });
    await get().loadWorkspaces();
  },

  logout: () => {
    api.logout();
    set({
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      preferences: {
        theme: 'dark',
        defaultRefreshInterval: 300,
        notificationsEnabled: true,
        compactMode: false,
      },
    });
  },

  // Toast actions
  addToast: (message, type) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message, type }],
    }));
  },

  removeToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),

  // Preferences actions
  loadPreferences: async () => {
    try {
      const prefs = await api.fetchPreferences();
      set({ preferences: prefs });
      // Apply theme
      document.documentElement.setAttribute('data-theme', prefs.theme);
    } catch {
      // Preferences endpoint might not exist yet; keep defaults
    }
  },

  updatePreferences: async (prefs) => {
    try {
      const updated = await api.updatePreferences(prefs);
      set({ preferences: updated });
      document.documentElement.setAttribute('data-theme', updated.theme);
      get().addToast('Preferences saved', 'success');
    } catch (err) {
      get().addToast(
        `Failed to save preferences: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  // Connection status
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Bookmark actions
  loadBookmarks: async () => {
    try {
      const bookmarks = await api.fetchBookmarks();
      const ids = new Set(bookmarks.map((b) => b.contentId));
      set({ bookmarks, bookmarkedContentIds: ids });
    } catch {
      // Bookmarks endpoint might not exist yet
    }
  },

  addBookmark: async (data) => {
    try {
      const bookmark = await api.createBookmark(data);
      set((s) => ({
        bookmarks: [bookmark, ...s.bookmarks],
        bookmarkedContentIds: new Set([...s.bookmarkedContentIds, bookmark.contentId]),
      }));
      get().addToast('Bookmarked', 'success');
    } catch (err) {
      get().addToast(
        `Failed to bookmark: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  removeBookmark: async (id) => {
    const bookmark = get().bookmarks.find((b) => b.id === id);
    try {
      await api.deleteBookmark(id);
      set((s) => {
        const newIds = new Set(s.bookmarkedContentIds);
        if (bookmark) newIds.delete(bookmark.contentId);
        return {
          bookmarks: s.bookmarks.filter((b) => b.id !== id),
          bookmarkedContentIds: newIds,
        };
      });
      get().addToast('Bookmark removed', 'success');
    } catch (err) {
      get().addToast(
        `Failed to remove bookmark: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  setBookmarksPanelOpen: (open) => set({ bookmarksPanelOpen: open }),

  isBookmarked: (contentId) => get().bookmarkedContentIds.has(contentId),

  // Saved Searches (Track A)
  savedSearches: [],
  savedSearchesModalOpen: false,
  setSavedSearchesModalOpen: (open) => set({ savedSearchesModalOpen: open }),
  notifications: [],
  notificationCount: 0,

  loadSavedSearches: async () => {
    try {
      const searches = await api.fetchSavedSearches();
      set({ savedSearches: searches });
    } catch {
      // Endpoint might not exist yet
    }
  },

  addSavedSearch: async (data) => {
    try {
      const search = await api.createSavedSearch(data);
      set((s) => ({ savedSearches: [search, ...s.savedSearches] }));
      get().addToast(`Saved search "${data.name}" created`, 'success');
    } catch (err) {
      get().addToast(
        `Failed to create saved search: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  removeSavedSearch: async (id) => {
    try {
      await api.deleteSavedSearch(id);
      set((s) => ({ savedSearches: s.savedSearches.filter((ss) => ss.id !== id) }));
      get().addToast('Saved search removed', 'success');
    } catch (err) {
      get().addToast(
        `Failed to remove saved search: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  // Analytics (Track B)
  analyticsData: null,
  analyticsPanelOpen: false,
  setAnalyticsPanelOpen: (open) => set({ analyticsPanelOpen: open }),

  loadAnalytics: async (workspaceId, period = '30') => {
    try {
      const data = await api.fetchWorkspaceAnalytics(workspaceId, period);
      set({ analyticsData: data });
    } catch (err) {
      get().addToast(
        `Failed to load analytics: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    }
  },

  // Import/Export (Track D)
  importExportModalOpen: false,
  setImportExportModalOpen: (open) => set({ importExportModalOpen: open }),
}));
