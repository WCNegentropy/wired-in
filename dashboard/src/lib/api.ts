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
// JWT helpers & token refresh
// ---------------------------------------------------------------------------

/** Decode the payload of a JWT (without verifying signature) to read claims. */
export function decodeJwtPayload(token: string): { sub: string; email: string; exp: number; iat: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

/** Check if the current token will expire within the given number of seconds. */
function tokenExpiresWithin(seconds: number): boolean {
  const token = getToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now < seconds;
}

/** Check if the session was expired (set by refresh failure). */
export function wasSessionExpired(): boolean {
  return localStorage.getItem('wiredin_session_expired') === 'true';
}

/** Clear the session expired flag. */
export function clearSessionExpired(): void {
  localStorage.removeItem('wiredin_session_expired');
}

/** Get the email from the expired token if available. */
export function getExpiredTokenEmail(): string | null {
  const token = getToken();
  if (token) {
    const payload = decodeJwtPayload(token);
    return payload?.email ?? null;
  }
  return null;
}

let refreshPromise: Promise<void> | null = null;

/** Proactively refresh the JWT if it's about to expire (within 5 minutes). */
async function ensureFreshToken(): Promise<void> {
  const token = getToken();
  if (!token) return;
  if (!tokenExpiresWithin(300)) return; // 5 minutes

  // Deduplicate concurrent refresh attempts
  if (refreshPromise) {
    await refreshPromise;
    return;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const data = fromApi<{ token: string; user: { id: string; email: string; name?: string } }>(json.data);
        setToken(data.token);
      } else {
        // Refresh failed — if token is actually expired, force logout
        const payload = decodeJwtPayload(token);
        if (payload && Math.floor(Date.now() / 1000) > payload.exp) {
          localStorage.setItem('wiredin_session_expired', 'true');
          logout();
          window.location.reload();
        }
      }
    } catch {
      // Network error during refresh — ignore, will retry on next API call
    } finally {
      refreshPromise = null;
    }
  })();

  await refreshPromise;
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
  await ensureFreshToken();
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
  await ensureFreshToken();
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
  await ensureFreshToken();
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
  await ensureFreshToken();
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

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export interface Bookmark {
  id: string;
  contentId: string;
  platform: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  author?: string;
  notes?: string;
  createdAt: string;
}

export async function fetchBookmarks(platform?: string): Promise<Bookmark[]> {
  const path = platform ? `/api/bookmarks?platform=${platform}` : '/api/bookmarks';
  return apiGet<Bookmark[]>(path);
}

export async function createBookmark(data: {
  contentId: string;
  platform: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  author?: string;
  notes?: string;
}): Promise<Bookmark> {
  return apiPost<Bookmark>('/api/bookmarks', data);
}

export async function updateBookmark(id: string, updates: { notes?: string }): Promise<Bookmark> {
  return apiPut<Bookmark>(`/api/bookmarks/${id}`, updates);
}

export async function deleteBookmark(id: string): Promise<void> {
  return apiDelete(`/api/bookmarks/${id}`);
}

export async function checkBookmarked(contentIds: string[]): Promise<Record<string, string>> {
  const params = contentIds.map((id) => `content_id=${encodeURIComponent(id)}`).join('&');
  return apiGet<Record<string, string>>(`/api/bookmarks/check?${params}`);
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export async function getOAuthUrl(provider: string): Promise<string> {
  const data = await apiGet<{ url: string }>(`/api/auth/oauth/${provider}`);
  return data.url;
}

export async function handleOAuthCallback(
  provider: string,
  code: string,
  state: string,
): Promise<{ token: string; user: { id: string; email: string; name?: string } }> {
  const res = await fetch(`${GATEWAY_URL}/api/auth/oauth/${provider}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `OAuth callback failed: ${res.status}`);
  }
  const json = await res.json();
  const data = fromApi<{ token: string; user: { id: string; email: string; name?: string } }>(json.data);
  setToken(data.token);
  return data;
}

// ---------------------------------------------------------------------------
// Workspace Sharing
// ---------------------------------------------------------------------------

export interface ShareLink {
  id: string;
  shareToken: string;
  permission: 'view' | 'edit';
  expiresAt?: string;
  createdAt: string;
}

export async function createShareLink(
  workspaceId: string,
  options?: { permission?: 'view' | 'edit'; expiresInHours?: number },
): Promise<{ shareUrl: string; token: string; permission: string; expiresAt?: string }> {
  return apiPost(`/api/workspaces/${workspaceId}/share`, options ?? {});
}

export async function listShareLinks(workspaceId: string): Promise<ShareLink[]> {
  return apiGet<ShareLink[]>(`/api/workspaces/${workspaceId}/shares`);
}

export async function revokeShareLink(workspaceId: string, shareId: string): Promise<void> {
  return apiDelete(`/api/workspaces/${workspaceId}/share/${shareId}`);
}

export async function fetchSharedWorkspace(token: string): Promise<{ workspace: Workspace; owner: string }> {
  const res = await fetch(`${GATEWAY_URL}/api/shared/${token}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load shared workspace: ${res.status}`);
  }
  const json = await res.json();
  return fromApi<{ workspace: Workspace; owner: string }>(json.data);
}

// ---------------------------------------------------------------------------
// Feed Status
// ---------------------------------------------------------------------------

export async function fetchFeedStatus(): Promise<{ platforms: Array<{ name: string; lastRefreshAt?: string; itemCount: number; error?: string }> }> {
  return apiGet('/api/feeds/status');
}

// ---------------------------------------------------------------------------
// Saved Searches (Track A)
// ---------------------------------------------------------------------------

export interface SavedSearchEntry {
  id: string;
  name: string;
  query: string;
  platforms: string[];
  notify: boolean;
  createdAt: string;
}

export async function fetchSavedSearches(): Promise<SavedSearchEntry[]> {
  return apiGet<SavedSearchEntry[]>('/api/saved-searches');
}

export async function createSavedSearch(data: {
  name: string;
  query: string;
  platforms?: string[];
  notify?: boolean;
}): Promise<SavedSearchEntry> {
  return apiPost<SavedSearchEntry>('/api/saved-searches', data);
}

export async function updateSavedSearch(
  id: string,
  updates: { name?: string; query?: string; platforms?: string[]; notify?: boolean },
): Promise<SavedSearchEntry> {
  return apiPut<SavedSearchEntry>(`/api/saved-searches/${id}`, updates);
}

export async function deleteSavedSearch(id: string): Promise<void> {
  return apiDelete(`/api/saved-searches/${id}`);
}

// ---------------------------------------------------------------------------
// Content Analytics (Track B)
// ---------------------------------------------------------------------------

import type { WorkspaceAnalytics } from '../types';

export async function trackClick(data: {
  workspaceId: string;
  tileId?: string;
  contentId: string;
  platform: string;
  title?: string;
  url: string;
}): Promise<void> {
  await apiPost('/api/analytics/click', data);
}

export async function fetchWorkspaceAnalytics(
  workspaceId: string,
  period: '7' | '30' | 'all' = '30',
): Promise<WorkspaceAnalytics> {
  return apiGet<WorkspaceAnalytics>(`/api/analytics/workspace/${workspaceId}?period=${period}`);
}

export async function exportAnalyticsCsv(workspaceId: string): Promise<Blob> {
  await ensureFreshToken();
  const res = await fetchWithRetry(
    `${GATEWAY_URL}/api/analytics/workspace/${workspaceId}/export`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error('Failed to export analytics');
  return res.blob();
}

// ---------------------------------------------------------------------------
// Import/Export (Track D)
// ---------------------------------------------------------------------------

import type { WorkspaceExport } from '../types';

export async function exportWorkspace(workspaceId: string): Promise<WorkspaceExport> {
  return apiGet<WorkspaceExport>(`/api/workspaces/${workspaceId}/export`);
}

export async function exportAllWorkspaces(): Promise<WorkspaceExport> {
  return apiGet<WorkspaceExport>('/api/workspaces/export-all');
}

export async function importWorkspaces(
  data: WorkspaceExport,
): Promise<{ workspaceIds: string[]; workspaceCount: number; tileCount: number }> {
  return apiPost('/api/workspaces/import', data);
}

export async function importOpml(
  xmlContent: string,
  workspaceName?: string,
): Promise<{ workspaceId: string; workspaceName: string; tileCount: number }> {
  await ensureFreshToken();
  const nameParam = workspaceName ? `?name=${encodeURIComponent(workspaceName)}` : '';
  const res = await fetchWithRetry(
    `${GATEWAY_URL}/api/import/opml${nameParam}`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/xml' },
      body: xmlContent,
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `OPML import failed: ${res.status}`);
  }
  const json = await res.json();
  return fromApi<{ workspaceId: string; workspaceName: string; tileCount: number }>(json.data);
}
