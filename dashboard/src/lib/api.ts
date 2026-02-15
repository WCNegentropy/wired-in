import type { Workspace, Tile } from '../types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';
const TOKEN_KEY = 'wiredin_token';

// ---------------------------------------------------------------------------
// Case-mapping helpers (snake_case <-> camelCase)
// ---------------------------------------------------------------------------

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function mapKeys(obj: unknown, mapper: (key: string) => string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => mapKeys(item, mapper));
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[mapper(key)] = mapKeys(value, mapper);
    }
    return result;
  }
  return obj;
}

/** Convert API response (snake_case) to frontend (camelCase) */
function fromApi<T>(data: unknown): T {
  return mapKeys(data, snakeToCamel) as T;
}

/** Convert frontend object (camelCase) to API request body (snake_case) */
function toApi(data: unknown): unknown {
  return mapKeys(data, camelToSnake);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

// ---------------------------------------------------------------------------
// Generic API helpers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error: ${res.status}`);
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError ?? new Error('Request failed after retries');
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${GATEWAY_URL}${path}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return fromApi<T>(json.data);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(toApi(body)),
  });
  if (!res.ok) {
    const respBody = await res.json().catch(() => ({}));
    throw new Error(respBody.error || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return fromApi<T>(json.data);
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${GATEWAY_URL}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(toApi(body)),
  });
  if (!res.ok) {
    const respBody = await res.json().catch(() => ({}));
    throw new Error(respBody.error || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return fromApi<T>(json.data);
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetchWithRetry(`${GATEWAY_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const respBody = await res.json().catch(() => ({}));
    throw new Error(respBody.error || `Request failed: ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Workspace CRUD
// ---------------------------------------------------------------------------

export async function fetchWorkspaces(): Promise<Workspace[]> {
  return apiGet<Workspace[]>('/api/workspaces');
}

export async function createWorkspace(name: string, description: string): Promise<Workspace> {
  return apiPost<Workspace>('/api/workspaces', { name, description });
}

export async function updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace> {
  return apiPut<Workspace>(`/api/workspaces/${id}`, updates);
}

export async function deleteWorkspace(id: string): Promise<void> {
  return apiDelete(`/api/workspaces/${id}`);
}

// ---------------------------------------------------------------------------
// Tile CRUD
// ---------------------------------------------------------------------------

export async function fetchTiles(workspaceId: string): Promise<Tile[]> {
  return apiGet<Tile[]>(`/api/workspaces/${workspaceId}/tiles`);
}

export async function createTile(workspaceId: string, tileData: Partial<Tile>): Promise<Tile> {
  return apiPost<Tile>(`/api/workspaces/${workspaceId}/tiles`, tileData);
}

export async function updateTile(tileId: string, updates: Partial<Tile>): Promise<Tile> {
  return apiPut<Tile>(`/api/tiles/${tileId}`, updates);
}

export async function deleteTile(tileId: string): Promise<void> {
  return apiDelete(`/api/tiles/${tileId}`);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function registerUser(
  email: string,
  password: string,
  name?: string,
): Promise<{ token: string; user: { id: string; email: string; name?: string } }> {
  const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Registration failed: ${res.status}`);
  }
  const json = await res.json();
  const data = fromApi<{ token: string; user: { id: string; email: string; name?: string } }>(json.data);
  setToken(data.token);
  return data;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ token: string; user: { id: string; email: string; name?: string } }> {
  const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Login failed: ${res.status}`);
  }
  const json = await res.json();
  const data = fromApi<{ token: string; user: { id: string; email: string; name?: string } }>(json.data);
  setToken(data.token);
  return data;
}

// ---------------------------------------------------------------------------
// API Key Management
// ---------------------------------------------------------------------------

export interface ApiKeyEntry {
  id: string;
  platform: string;
  keyName: string;
  keyValueMasked: string;
  hasSecret: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchApiKeys(): Promise<ApiKeyEntry[]> {
  return apiGet<ApiKeyEntry[]>('/api/keys');
}

export async function createApiKey(data: {
  platform: string;
  keyName: string;
  keyValue: string;
  keySecret?: string;
}): Promise<ApiKeyEntry> {
  return apiPost<ApiKeyEntry>('/api/keys', data);
}

export async function updateApiKey(
  id: string,
  updates: { keyValue?: string; keySecret?: string; isActive?: boolean },
): Promise<ApiKeyEntry> {
  return apiPut<ApiKeyEntry>(`/api/keys/${id}`, updates);
}

export async function deleteApiKey(id: string): Promise<void> {
  return apiDelete(`/api/keys/${id}`);
}

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export interface UserPreferences {
  theme: 'dark' | 'light';
  defaultRefreshInterval: number;
  notificationsEnabled: boolean;
  compactMode: boolean;
}

export async function fetchPreferences(): Promise<UserPreferences> {
  return apiGet<UserPreferences>('/api/user/preferences');
}

export async function updatePreferences(
  prefs: Partial<UserPreferences>,
): Promise<UserPreferences> {
  return apiPut<UserPreferences>('/api/user/preferences', prefs);
}

// ---------------------------------------------------------------------------
// Batch Tile Position Update
// ---------------------------------------------------------------------------

export async function batchUpdateTilePositions(
  workspaceId: string,
  positions: Array<{ tileId: string; x: number; y: number; w: number; h: number }>,
): Promise<void> {
  await apiPut(`/api/workspaces/${workspaceId}/tile-positions`, { positions });
}

// ---------------------------------------------------------------------------
// Existing exports (preserved)
// ---------------------------------------------------------------------------

export async function fetchFeed(platform: string, config: Record<string, string>): Promise<unknown[]> {
  const params = new URLSearchParams(config);
  const res = await fetch(`${GATEWAY_URL}/api/feeds/${platform}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${platform} feed`);
  const data = await res.json();
  const items = data.items ?? data.data ?? data;
  return Array.isArray(items) ? (items as unknown[]).map((item) => fromApi(item)) : [];
}

export async function searchPlatform(platform: string, query: string): Promise<unknown[]> {
  const res = await fetch(`${GATEWAY_URL}/api/feeds/${platform}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed for ${platform}`);
  const data = await res.json();
  return data.items ?? data;
}

export async function fetchPlatforms(): Promise<string[]> {
  const res = await fetch(`${GATEWAY_URL}/api/feeds/platforms`);
  if (!res.ok) return ['reddit', 'youtube', 'x', 'rss', 'news'];
  const data = await res.json();
  return data.platforms ?? [];
}

export function createSSEConnection(workspaceId: string, onMessage: (event: MessageEvent) => void): EventSource {
  const es = new EventSource(`${GATEWAY_URL}/api/stream?workspace_id=${workspaceId}`);
  es.onmessage = onMessage;
  return es;
}
