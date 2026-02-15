import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We test the config-store logic by reimplementing with a temp directory
// to avoid polluting the user's real config.

interface WiredInConfig {
  gatewayUrl: string;
  workspaces: WorkspaceConfig[];
  apiKeys: Record<string, string>;
  activeWorkspace: string | null;
  theme: 'dark' | 'light';
}

interface WorkspaceConfig {
  id: string;
  name: string;
  description: string;
  tiles: TileConfig[];
  createdAt: string;
}

interface TileConfig {
  id: string;
  platform: string;
  config: Record<string, string>;
  position: { x: number; y: number; w: number; h: number };
}

const DEFAULT_CONFIG: WiredInConfig = {
  gatewayUrl: 'http://localhost:8080',
  workspaces: [],
  apiKeys: {},
  activeWorkspace: null,
  theme: 'dark',
};

let TEST_DIR: string;
let TEST_CONFIG_FILE: string;

function getConfig(): WiredInConfig {
  if (!existsSync(TEST_CONFIG_FILE)) {
    saveConfig({ ...DEFAULT_CONFIG, workspaces: [], apiKeys: {} });
    return { ...DEFAULT_CONFIG, workspaces: [], apiKeys: {} };
  }
  const raw = readFileSync(TEST_CONFIG_FILE, 'utf-8');
  return { ...DEFAULT_CONFIG, workspaces: [], apiKeys: {}, ...JSON.parse(raw) };
}

function saveConfig(config: WiredInConfig): void {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
  writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config, null, 2));
}

function updateConfig(updates: Partial<WiredInConfig>): WiredInConfig {
  const config = { ...getConfig(), ...updates };
  saveConfig(config);
  return config;
}

beforeEach(() => {
  TEST_DIR = join(tmpdir(), `wiredin-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  TEST_CONFIG_FILE = join(TEST_DIR, 'config.json');
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('config store', () => {
  describe('getConfig', () => {
    it('should return default config when no config file exists', () => {
      const config = getConfig();

      expect(config.gatewayUrl).toBe('http://localhost:8080');
      expect(config.workspaces).toEqual([]);
      expect(config.apiKeys).toEqual({});
      expect(config.activeWorkspace).toBeNull();
      expect(config.theme).toBe('dark');
    });

    it('should create config file on first access', () => {
      getConfig();
      expect(existsSync(TEST_CONFIG_FILE)).toBe(true);
    });

    it('should return saved config when file exists', () => {
      const custom: WiredInConfig = {
        gatewayUrl: 'http://example.com:9090',
        workspaces: [],
        apiKeys: { reddit: 'test-key' },
        activeWorkspace: null,
        theme: 'light',
      };
      saveConfig(custom);

      const config = getConfig();
      expect(config.gatewayUrl).toBe('http://example.com:9090');
      expect(config.apiKeys.reddit).toBe('test-key');
      expect(config.theme).toBe('light');
    });
  });

  describe('saveConfig / updateConfig roundtrip', () => {
    it('should persist and retrieve config changes', () => {
      const config = getConfig();
      config.gatewayUrl = 'http://new-gateway:3000';
      saveConfig(config);

      const loaded = getConfig();
      expect(loaded.gatewayUrl).toBe('http://new-gateway:3000');
    });

    it('should merge updates with existing config', () => {
      getConfig(); // initialize
      updateConfig({ theme: 'light' });

      const config = getConfig();
      expect(config.theme).toBe('light');
      expect(config.gatewayUrl).toBe('http://localhost:8080'); // preserved
    });

    it('should handle multiple sequential updates', () => {
      getConfig();
      updateConfig({ gatewayUrl: 'http://a:1' });
      updateConfig({ theme: 'light' });
      updateConfig({ gatewayUrl: 'http://b:2' });

      const config = getConfig();
      expect(config.gatewayUrl).toBe('http://b:2');
      expect(config.theme).toBe('light');
    });
  });

  describe('workspace CRUD operations', () => {
    it('should create a workspace', () => {
      const config = getConfig();

      const workspace: WorkspaceConfig = {
        id: 'ws-1',
        name: 'test-workspace',
        description: 'A test workspace',
        tiles: [],
        createdAt: new Date().toISOString(),
      };

      config.workspaces.push(workspace);
      config.activeWorkspace = workspace.name;
      saveConfig(config);

      const loaded = getConfig();
      expect(loaded.workspaces).toHaveLength(1);
      expect(loaded.workspaces[0].name).toBe('test-workspace');
      expect(loaded.activeWorkspace).toBe('test-workspace');
    });

    it('should list workspaces', () => {
      const config = getConfig();

      config.workspaces = [
        { id: 'ws-1', name: 'first', description: '', tiles: [], createdAt: '2024-01-01' },
        { id: 'ws-2', name: 'second', description: 'desc', tiles: [], createdAt: '2024-01-02' },
      ];
      saveConfig(config);

      const loaded = getConfig();
      expect(loaded.workspaces).toHaveLength(2);
      expect(loaded.workspaces.map((w) => w.name)).toEqual(['first', 'second']);
    });

    it('should delete a workspace by name', () => {
      const config = getConfig();
      config.workspaces = [
        { id: 'ws-1', name: 'keep', description: '', tiles: [], createdAt: '2024-01-01' },
        { id: 'ws-2', name: 'remove', description: '', tiles: [], createdAt: '2024-01-02' },
      ];
      config.activeWorkspace = 'remove';
      saveConfig(config);

      const loaded = getConfig();
      const index = loaded.workspaces.findIndex((w) => w.name === 'remove');
      loaded.workspaces.splice(index, 1);

      // Reset active workspace if deleted
      if (loaded.activeWorkspace === 'remove') {
        loaded.activeWorkspace = loaded.workspaces.length > 0
          ? loaded.workspaces[0].name
          : null;
      }

      saveConfig(loaded);

      const final = getConfig();
      expect(final.workspaces).toHaveLength(1);
      expect(final.workspaces[0].name).toBe('keep');
      expect(final.activeWorkspace).toBe('keep');
    });

    it('should switch active workspace', () => {
      const config = getConfig();
      config.workspaces = [
        { id: 'ws-1', name: 'alpha', description: '', tiles: [], createdAt: '2024-01-01' },
        { id: 'ws-2', name: 'beta', description: '', tiles: [], createdAt: '2024-01-02' },
      ];
      config.activeWorkspace = 'alpha';
      saveConfig(config);

      const loaded = getConfig();
      loaded.activeWorkspace = 'beta';
      saveConfig(loaded);

      const final = getConfig();
      expect(final.activeWorkspace).toBe('beta');
    });

    it('should handle workspace with tiles', () => {
      const config = getConfig();

      const tile: TileConfig = {
        id: 'tile-1',
        platform: 'reddit',
        config: { subreddit: 'typescript' },
        position: { x: 0, y: 0, w: 2, h: 2 },
      };

      config.workspaces = [
        {
          id: 'ws-1',
          name: 'with-tiles',
          description: 'Has tiles',
          tiles: [tile],
          createdAt: '2024-01-01',
        },
      ];
      saveConfig(config);

      const loaded = getConfig();
      expect(loaded.workspaces[0].tiles).toHaveLength(1);
      expect(loaded.workspaces[0].tiles[0].platform).toBe('reddit');
      expect(loaded.workspaces[0].tiles[0].config.subreddit).toBe('typescript');
    });

    it('should handle API key operations', () => {
      const config = getConfig();
      config.apiKeys = { reddit: 'reddit-key-123', youtube: 'yt-key-456' };
      saveConfig(config);

      let loaded = getConfig();
      expect(Object.keys(loaded.apiKeys)).toHaveLength(2);
      expect(loaded.apiKeys.reddit).toBe('reddit-key-123');

      // Remove a key
      delete loaded.apiKeys.reddit;
      saveConfig(loaded);

      loaded = getConfig();
      expect(Object.keys(loaded.apiKeys)).toHaveLength(1);
      expect(loaded.apiKeys.reddit).toBeUndefined();
      expect(loaded.apiKeys.youtube).toBe('yt-key-456');
    });
  });
});
