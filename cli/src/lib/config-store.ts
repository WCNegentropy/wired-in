import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface WiredInConfig {
  gatewayUrl: string;
  workspaces: WorkspaceConfig[];
  apiKeys: Record<string, string>;
  activeWorkspace: string | null;
  theme: 'dark' | 'light';
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  description: string;
  tiles: TileConfig[];
  createdAt: string;
}

export interface TileConfig {
  id: string;
  platform: string;
  config: Record<string, string>;
  position: { x: number; y: number; w: number; h: number };
}

const CONFIG_DIR = join(homedir(), '.wiredin');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: WiredInConfig = {
  gatewayUrl: 'http://localhost:8080',
  workspaces: [],
  apiKeys: {},
  activeWorkspace: null,
  theme: 'dark',
};

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getDefaultConfig(): WiredInConfig {
  return { ...DEFAULT_CONFIG, workspaces: [], apiKeys: {} };
}

export function getConfig(): WiredInConfig {
  if (!existsSync(CONFIG_FILE)) {
    saveConfig(getDefaultConfig());
    return getDefaultConfig();
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8');
  return { ...getDefaultConfig(), ...JSON.parse(raw) };
}

export function saveConfig(config: WiredInConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function updateConfig(updates: Partial<WiredInConfig>): WiredInConfig {
  const config = { ...getConfig(), ...updates };
  saveConfig(config);
  return config;
}
