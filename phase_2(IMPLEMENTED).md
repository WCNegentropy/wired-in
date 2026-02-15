# ✅ (IMPLEMENTED)

---

# Wired-In — Phase 2 Implementation Plan
## "Completing the Loop: Persistence, Caching, Real-Time, and Auth"

---

## Current State Recap

PR #3 implemented the core Postgres + Redis + live data infrastructure. What's live now:

| ✅ Working | ❌ Remaining |
|-----------|-------------|
| Gateway workspace/tile CRUD → Postgres via sqlx | Proxy response caching (Redis infra built, not wired into proxy handlers) |
| Aggregator CacheService → Redis via ioredis | Dashboard workspace persistence (still client-only, API functions missing) |
| Aggregator ContentService → write-through to Postgres + hydration on startup | Tile auto-refresh timer |
| Dashboard TileCard fetches live data from API (with mock fallback) | SSE stream still placeholder (no Redis pub/sub) |
| | JWT auth (entirely unstarted — `jsonwebtoken` crate present but unused) |
| | camelCase ↔ snake_case mapping between gateway and dashboard |

---

## Implementation Plan — 5 Tracks, 14 Tasks

### Track A: Complete Proxy Caching (leftover from Phase 1)

#### Task A.1 — Wire Redis Caching into Gateway Proxy Handlers

**Target files:** `gateway/src/routes/proxy.rs`

**What exists:** `cache.rs` already exposes `get_cached(conn, key) -> Option<String>` and `set_cached(conn, key, value, ttl)`. `AppState.redis` (a `ConnectionManager`) is available in every handler.

**What to do:**

Add cache-check-before-proxy + cache-on-response to `get_feeds`, `get_content`, and `search_content`. The pattern is identical for each:

```rust name=gateway/src/routes/proxy.rs
// In get_feeds, before the http_client.get() call:
let cache_key = format!("proxy:feeds:{}:{}", platform, query_string);
let mut redis = state.redis.clone();

if let Some(cached) = crate::cache::get_cached(&mut redis, &cache_key).await {
    info!("Cache hit for GET /api/feeds/{}", platform);
    return HttpResponse::Ok()
        .content_type("application/json")
        .body(cached);
}

// ... existing proxy logic ...

// After successfully reading the response body:
let _ = crate::cache::set_cached(&mut redis, &cache_key, &body, 300).await;
```

Apply the same pattern to `get_content` (key: `proxy:content:{query_string}`, TTL: 120s) and `search_content` (key: `proxy:search:{query_string}`, TTL: 60s).

**Do NOT cache** `subscribe_feed` (it's a write operation).

**Design consideration:** Use shorter TTLs for search (60s) since users expect fresh results when searching. Feed data can use 300s since it aligns with the aggregator's feed cache TTL.

---

### Track B: Dashboard ↔ Gateway Persistence

This is the highest-impact track — it connects the frontend to the database so workspace configuration survives page refresh.

#### Task B.1 — API Client: Workspace & Tile CRUD Functions

**Target file:** `dashboard/src/lib/api.ts`

**What to do:**

Add all missing CRUD functions with snake_case ↔ camelCase mapping. The gateway serializes Rust structs with `snake_case` field names (`created_at`, `workspace_id`, `refresh_interval_secs`), but the dashboard `types/index.ts` uses `camelCase` (`createdAt`, `refreshIntervalSecs`).

```typescript name=dashboard/src/lib/api.ts
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

// ── Helpers ──────────────────────────────────────────────────
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function mapKeys(obj: any, fn: (key: string) => string): any {
  if (Array.isArray(obj)) return obj.map((v) => mapKeys(v, fn));
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [fn(k), mapKeys(v, fn)])
    );
  }
  return obj;
}

function fromApi<T>(data: unknown): T {
  return mapKeys(data, snakeToCamel) as T;
}

function toApi(data: unknown): unknown {
  return mapKeys(data, camelToSnake);
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  const json = await res.json();
  return fromApi<T>(json.data ?? json);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApi(body)),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  const json = await res.json();
  return fromApi<T>(json.data ?? json);
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApi(body)),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  const json = await res.json();
  return fromApi<T>(json.data ?? json);
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
}

// ── Existing functions (keep, but update fetchFeed return) ──
export async function fetchFeed(platform: string, config: Record<string, string>): Promise<unknown[]> {
  const params = new URLSearchParams(config);
  const res = await fetch(`${GATEWAY_URL}/api/feeds/${platform}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${platform} feed`);
  const data = await res.json();
  const items = data.items ?? data.data ?? data;
  return Array.isArray(items) ? items.map((i: any) => fromApi(i)) : [];
}

// ── Workspace CRUD ──────────────────────────────────────────
export async function fetchWorkspaces(): Promise<Workspace[]> {
  return apiGet<Workspace[]>('/api/workspaces');
}

export async function createWorkspace(name: string, description: string): Promise<Workspace> {
  return apiPost<Workspace>('/api/workspaces', { name, description });
}

export async function updateWorkspace(id: string, updates: { name?: string; description?: string }): Promise<Workspace> {
  return apiPut<Workspace>(`/api/workspaces/${id}`, updates);
}

export async function deleteWorkspace(id: string): Promise<void> {
  return apiDelete(`/api/workspaces/${id}`);
}

// ── Tile CRUD ───────────────────────────────────────────────
export async function fetchTiles(workspaceId: string): Promise<Tile[]> {
  return apiGet<Tile[]>(`/api/workspaces/${workspaceId}/tiles`);
}

export async function createTile(workspaceId: string, tile: {
  platform: Platform;
  config: TileConfig;
  position: TilePosition;
  refreshIntervalSecs: number;
}): Promise<Tile> {
  return apiPost<Tile>(`/api/workspaces/${workspaceId}/tiles`, tile);
}

export async function updateTile(tileId: string, updates: Partial<Tile>): Promise<Tile> {
  return apiPut<Tile>(`/api/tiles/${tileId}`, updates);
}

export async function deleteTile(tileId: string): Promise<void> {
  return apiDelete(`/api/tiles/${tileId}`);
}

// ── SSE + search (keep existing) ────────────────────────────
export async function searchPlatform(platform: string, query: string): Promise<unknown[]> { /* ... existing ... */ }
export async function fetchPlatforms(): Promise<string[]> { /* ... existing ... */ }
export function createSSEConnection(workspaceId: string, onMessage: (event: MessageEvent) => void): EventSource { /* ... existing ... */ }
```

**Key detail:** The `TileConfig` uses `#[serde(flatten)]` on the gateway side, meaning config fields are serialized flat into the JSON (e.g., `{"subreddit": "...", "maxItems": 10}`), NOT as `{"extra": {...}}`. The mapping layer must not descend into config objects that use arbitrary/platform-specific keys — those should be passed through as-is. The `mapKeys` function handles this because it recursively transforms all keys, which is correct since both sides use the same keys for config (they're already lowercase platform-specific names).

#### Task B.2 — Store: Connect Actions to Gateway API

**Target file:** `dashboard/src/store/index.ts`

**What to do:**

1. **Replace hardcoded `defaultWorkspace`** with empty initial state + a `loadWorkspaces()` action that fetches from the API on app init.

2. **Make mutating actions call the API first**, then update local state on success. Convert the store to use `zustand`'s `get` parameter for async actions:

```typescript name=dashboard/src/store/index.ts
import { create } from 'zustand';
import type { Workspace, Tile, Platform, ContentItem, TileConfig, TilePosition } from '../types';
import * as api from '../lib/api';

interface WiredInState {
  // Data
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  tileContent: Record<string, ContentItem[]>;
  tileLoading: Record<string, boolean>;
  initialLoading: boolean;

  // UI state
  sidebarOpen: boolean;
  addTileModalOpen: boolean;
  editingTileId: string | null;
  globalSearch: string;

  // Actions
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string, description: string) => Promise<void>;
  removeWorkspace: (id: string) => Promise<void>;
  addTile: (workspaceId: string, platform: Platform, config: TileConfig) => Promise<void>;
  updateTile: (tileId: string, updates: Partial<Tile>) => Promise<void>;
  removeTile: (tileId: string) => Promise<void>;
  updateTilePositions: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  setTileContent: (tileId: string, content: ContentItem[]) => void;
  setTileLoading: (tileId: string, loading: boolean) => void;
  toggleSidebar: () => void;
  setAddTileModalOpen: (open: boolean) => void;
  setEditingTileId: (id: string | null) => void;
  setGlobalSearch: (search: string) => void;
}

export const useWiredInStore = create<WiredInState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  tileContent: {},
  tileLoading: {},
  initialLoading: true,
  sidebarOpen: true,
  addTileModalOpen: false,
  editingTileId: null,
  globalSearch: '',

  loadWorkspaces: async () => {
    try {
      const workspaces = await api.fetchWorkspaces();
      set({
        workspaces,
        activeWorkspaceId: workspaces[0]?.id ?? null,
        initialLoading: false,
      });
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      set({ initialLoading: false });
    }
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addWorkspace: async (name, description) => {
    const workspace = await api.createWorkspace(name, description);
    set((s) => ({
      workspaces: [...s.workspaces, workspace],
      activeWorkspaceId: workspace.id,
    }));
  },

  removeWorkspace: async (id) => {
    await api.deleteWorkspace(id);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id
        ? s.workspaces.find((w) => w.id !== id)?.id ?? null
        : s.activeWorkspaceId,
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
        w.id === workspaceId
          ? { ...w, tiles: [...w.tiles, tile], updatedAt: new Date().toISOString() }
          : w
      ),
      addTileModalOpen: false,
    }));
  },

  updateTile: async (tileId, updates) => {
    const updated = await api.updateTile(tileId, updates);
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tiles: w.tiles.map((t) => (t.id === tileId ? updated : t)),
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

  // Position updates are batched locally — debounce API call
  updateTilePositions: (layouts) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === s.activeWorkspaceId
          ? {
              ...w,
              tiles: w.tiles.map((t) => {
                const l = layouts.find((lay) => lay.i === t.id);
                return l ? { ...t, position: { x: l.x, y: l.y, w: l.w, h: l.h } } : t;
              }),
            }
          : w
      ),
    })),

  // ... rest unchanged (setTileContent, setTileLoading, toggle*, set*)
}));
```

**Key design decisions:**
- `addWorkspace`, `removeWorkspace`, `addTile`, `updateTile`, `removeTile` are now `async` — they call the API **first**, then update local state only on success
- `updateTilePositions` stays local-only (too frequent to round-trip) — a future debounced `persistTilePositions()` can batch-update via API
- Added `initialLoading: boolean` so the UI can show a loading state until workspaces are fetched

#### Task B.3 — App Init: Load Workspaces on Mount

**Target files:** `dashboard/src/App.tsx`

**What to do:**

Call `loadWorkspaces()` on app mount and show a loading state:

```typescript name=dashboard/src/App.tsx
import { useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TileGrid from './components/TileGrid';
import AddTileModal from './components/AddTileModal';
import { useWiredInStore } from './store';

function App() {
  const sidebarOpen = useWiredInStore((s) => s.sidebarOpen);
  const initialLoading = useWiredInStore((s) => s.initialLoading);
  const loadWorkspaces = useWiredInStore((s) => s.loadWorkspaces);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  if (initialLoading) {
    return (
      <div className="app-shell app-shell--loading">
        <div className="loading-screen">
          <h2>Wired In</h2>
          <p>Loading workspaces...</p>
        </div>
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
    </div>
  );
}

export default App;
```

#### Task B.4 — Dashboard Types: Add `workspaceId` to `Tile`

**Target file:** `dashboard/src/types/index.ts`

The gateway's `Tile` model includes `workspace_id` (mapped to `workspaceId`). The dashboard's `Tile` interface currently omits this field — it needs it for API persistence:

```typescript name=dashboard/src/types/index.ts
export interface Tile {
  id: string;
  workspaceId?: string;  // present when loaded from API
  platform: Platform;
  config: TileConfig;
  position: TilePosition;
  refreshIntervalSecs: number;
}
```

Make it optional so existing in-memory-created tiles (during graceful degradation) still work.

---

### Track C: Tile Auto-Refresh

#### Task C.1 — Add Periodic Refresh Timer to TileCard

**Target file:** `dashboard/src/components/TileCard.tsx`

**What to do:**

Add a second `useEffect` that creates a `setInterval` based on `tile.refreshIntervalSecs`:

```typescript name=dashboard/src/components/TileCard.tsx
// After the existing mount-load effect:

// Periodic refresh based on tile's refresh interval
useEffect(() => {
  if (tile.refreshIntervalSecs <= 0) return;

  const interval = setInterval(() => {
    loadContent();
  }, tile.refreshIntervalSecs * 1000);

  return () => clearInterval(interval);
}, [tile.refreshIntervalSecs, loadContent]);
```

**This is a small addition** (6 lines) with significant UX impact — tiles will automatically stay fresh without manual clicking.

**Consideration:** The current tile defaults are `300s` (reddit), `600s` (news), `900s` (youtube). These are reasonable. No risk of API flooding since the gateway + aggregator already cache at these intervals.

---

### Track D: Real-Time SSE via Redis Pub/Sub

This connects all three backend services into a live push pipeline.

#### Task D.1 — Aggregator: Publish to Redis on New Content

**Target file:** `aggregator/src/feeds/feeds.service.ts`

**What to do:**

After normalizing and caching content in `fetchFeed()`, publish to a Redis channel so the gateway can forward to SSE clients:

1. **Inject Redis into FeedsService** — the `CacheService` already has a Redis connection, but pub/sub requires a separate connection (subscribers block). Add a `publish` method to `CacheService`:

```typescript name=aggregator/src/cache/cache.service.ts
// Add to CacheService:
async publish(channel: string, message: string): Promise<void> {
  await this.redis.publish(channel, message);
}
```

2. **Publish in `fetchFeed()`** after storing content:

```typescript name=aggregator/src/feeds/feeds.service.ts
// After line 87 (await this.contentService.setContentForPlatform(...)):
await this.cacheService.publish(
  `feed:updates:${platform}`,
  JSON.stringify({ platform, items: normalized, timestamp: new Date().toISOString() }),
);
```

#### Task D.2 — Gateway: Subscribe to Redis Channels in SSE Stream

**Target files:** `gateway/src/routes/stream.rs`, `gateway/src/cache.rs`

**What to do:**

Replace the placeholder tick-based stream with a Redis pub/sub subscriber:

1. **Add a subscriber factory to `cache.rs`**:

```rust name=gateway/src/cache.rs
use redis::Client;

/// Create a dedicated Redis pub/sub connection (separate from the pooled
/// connection manager because subscribers block).
pub async fn create_subscriber(redis_url: &str) -> redis::aio::PubSub {
    let client = Client::open(redis_url).expect("Invalid REDIS_URL for subscriber");
    let conn = client.get_async_connection().await.expect("Failed to create subscriber connection");
    conn.into_pubsub()
}
```

2. **Rewrite `stream.rs`** to subscribe to `feed:updates:*` channels and forward messages as SSE events:

```rust name=gateway/src/routes/stream.rs
use actix_web::{get, web, HttpResponse};
use chrono::Utc;
use futures::StreamExt;
use log::info;
use serde::Deserialize;
use std::time::Duration;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub workspace_id: Option<String>,
}

#[get("/stream")]
pub async fn event_stream(
    state: web::Data<AppState>,
    query: web::Query<StreamQuery>,
) -> HttpResponse {
    let workspace_id = query.workspace_id.clone().unwrap_or_else(|| "default".to_string());
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());

    info!("SSE client connected for workspace {}", workspace_id);

    let event_stream = async_stream::stream! {
        // Create a dedicated subscriber connection
        let mut pubsub = match crate::cache::create_subscriber(&redis_url).await {
            Ok(ps) => ps,
            Err(_) => {
                // Fallback: emit heartbeats only
                loop {
                    tokio::time::sleep(Duration::from_secs(15)).await;
                    let payload = format!(
                        "event: heartbeat\ndata: {}\n\n",
                        serde_json::json!({"type": "heartbeat", "timestamp": Utc::now().to_rfc3339()})
                    );
                    yield Ok::<_, actix_web::Error>(bytes::Bytes::from(payload));
                }
            }
        };

        // Subscribe to all platform feed update channels
        let _ = pubsub.psubscribe("feed:updates:*").await;

        let mut msg_stream = pubsub.on_message();
        let mut heartbeat_interval = tokio::time::interval(Duration::from_secs(15));

        loop {
            tokio::select! {
                Some(msg) = msg_stream.next() => {
                    if let Ok(payload) = msg.get_payload::<String>() {
                        let sse = format!("event: content\ndata: {}\n\n", payload);
                        yield Ok::<_, actix_web::Error>(bytes::Bytes::from(sse));
                    }
                }
                _ = heartbeat_interval.tick() => {
                    let hb = format!(
                        "event: heartbeat\ndata: {}\n\n",
                        serde_json::json!({
                            "type": "heartbeat",
                            "workspace_id": workspace_id,
                            "timestamp": Utc::now().to_rfc3339(),
                        })
                    );
                    yield Ok::<_, actix_web::Error>(bytes::Bytes::from(hb));
                }
            }
        }
    };

    HttpResponse::Ok()
        .insert_header(("Content-Type", "text/event-stream"))
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(Box::pin(event_stream))
}
```

**Add `async-stream` to `gateway/Cargo.toml`:**
```toml
async-stream = "0.3"
```

#### Task D.3 — Dashboard: Global SSE Manager Dispatches to Store

**Target files:** `dashboard/src/hooks/useSSE.ts` (new), `dashboard/src/App.tsx`

**What to do:**

1. **Create `useSSE.ts`** — a hook that manages the SSE connection lifecycle and dispatches `content` events to the Zustand store:

```typescript name=dashboard/src/hooks/useSSE.ts
import { useEffect, useRef } from 'react';
import { useWiredInStore } from '../store';
import { createSSEConnection } from '../lib/api';
import type { ContentItem } from '../types';

export function useSSE(workspaceId: string | null) {
  const setTileContent = useWiredInStore((s) => s.setTileContent);
  const workspaces = useWiredInStore((s) => s.workspaces);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const es = createSSEConnection(workspaceId, () => {});

    es.addEventListener('content', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const platform = data.platform;
        const items: ContentItem[] = data.items ?? [];

        // Find tiles that match this platform in the active workspace
        const activeWs = workspaces.find((w) => w.id === workspaceId);
        if (!activeWs) return;

        for (const tile of activeWs.tiles) {
          if (tile.platform === platform) {
            setTileContent(tile.id, items.slice(0, tile.config.maxItems ?? 10));
          }
        }
      } catch (err) {
        console.warn('Failed to parse SSE content event:', err);
      }
    });

    esRef.current = es;

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [workspaceId, workspaces, setTileContent]);
}
```

2. **Use the hook in `App.tsx`**:

```typescript name=dashboard/src/App.tsx
// Add after the loadWorkspaces effect:
const activeWorkspaceId = useWiredInStore((s) => s.activeWorkspaceId);
useSSE(activeWorkspaceId);
```

---

### Track E: JWT Authentication

This is the final and most complex track. It adds user accounts, login/register, and workspace ownership.

#### Task E.1 — Gateway: Users Table & Password Hashing

**Target files:** `gateway/migrations/002_create_users.sql` (new), `gateway/src/auth.rs` (new), `gateway/Cargo.toml`

1. **Add `argon2` dependency** to `Cargo.toml`:
   ```toml
   argon2 = "0.5"
   ```

2. **Create migration `002_create_users.sql`**:

```sql name=gateway/migrations/002_create_users.sql
CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    name           VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link workspaces to users (nullable for backward compat with existing data)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
```

3. **Create `gateway/src/auth.rs`** with JWT + password utilities:

```rust name=gateway/src/auth.rs
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id as string
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}

pub fn encode_jwt(user_id: Uuid, email: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp: (now + Duration::hours(24)).timestamp(),
        iat: now.timestamp(),
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
}

pub fn decode_jwt(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &Validation::default())?;
    Ok(token_data.claims)
}

pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default().hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok()
}
```

4. **Add `mod auth;`** to `main.rs`.

#### Task E.2 — Gateway: Auth Endpoints (Register + Login)

**Target files:** `gateway/src/routes/auth.rs` (new), `gateway/src/routes/mod.rs`, `gateway/src/models.rs`

1. **Add auth request/response models** to `models.rs`:

```rust name=gateway/src/models.rs
// Add to models.rs:
#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub name: Option<String>,
}
```

2. **Create `gateway/src/routes/auth.rs`**:

```rust name=gateway/src/routes/auth.rs
use actix_web::{post, web, HttpResponse};
use log::info;
use sqlx::Row;
use uuid::Uuid;

use crate::auth;
use crate::models::{ApiResponse, AuthResponse, LoginRequest, RegisterRequest, UserInfo};
use crate::state::AppState;

#[post("/register")]
pub async fn register(
    state: web::Data<AppState>,
    body: web::Json<RegisterRequest>,
) -> HttpResponse {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());

    // Check email uniqueness
    let exists: Option<bool> = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
        .bind(&body.email)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

    if exists == Some(true) {
        return HttpResponse::Conflict()
            .json(ApiResponse::<()>::err("Email already registered"));
    }

    let password_hash = match auth::hash_password(&body.password) {
        Ok(h) => h,
        Err(_) => return HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err("Failed to hash password")),
    };

    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query(
        "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(id).bind(&body.email).bind(&password_hash).bind(&body.name).bind(now).bind(now)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let token = auth::encode_jwt(id, &body.email, &jwt_secret).unwrap_or_default();
            info!("User registered: {} ({})", body.email, id);
            HttpResponse::Created().json(ApiResponse::ok(AuthResponse {
                token,
                user: UserInfo { id, email: body.email.clone(), name: body.name.clone() },
            }))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}

#[post("/login")]
pub async fn login(
    state: web::Data<AppState>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());

    let row = sqlx::query("SELECT id, email, password_hash, name FROM users WHERE email = $1")
        .bind(&body.email)
        .fetch_optional(&state.db)
        .await;

    match row {
        Ok(Some(user)) => {
            let hash: String = user.get("password_hash");
            if !auth::verify_password(&body.password, &hash) {
                return HttpResponse::Unauthorized()
                    .json(ApiResponse::<()>::err("Invalid credentials"));
            }
            let id: Uuid = user.get("id");
            let email: String = user.get("email");
            let name: Option<String> = user.get("name");
            let token = auth::encode_jwt(id, &email, &jwt_secret).unwrap_or_default();
            info!("User logged in: {}", email);
            HttpResponse::Ok().json(ApiResponse::ok(AuthResponse {
                token,
                user: UserInfo { id, email, name },
            }))
        }
        Ok(None) => HttpResponse::Unauthorized()
            .json(ApiResponse::<()>::err("Invalid credentials")),
        Err(e) => HttpResponse::InternalServerError()
            .json(ApiResponse::<()>::err(format!("Database error: {e}"))),
    }
}
```

3. **Register in `mod.rs`** — add `pub mod auth;` and mount the scope:

```rust name=gateway/src/routes/mod.rs
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            // Auth (public)
            .service(web::scope("/auth")
                .service(auth::register)
                .service(auth::login)
            )
            // ... existing routes
    );
}
```

#### Task E.3 — Gateway: Auth Middleware Extractor

**Target file:** `gateway/src/middleware.rs` (new)

Create an Actix-Web extractor that reads `Authorization: Bearer <token>`, validates the JWT, and extracts the user ID:

```rust name=gateway/src/middleware.rs
use actix_web::{FromRequest, HttpRequest, dev::Payload, Error, HttpResponse};
use futures::future::{ok, Ready};
use uuid::Uuid;
use std::future::Future;
use std::pin::Pin;

use crate::auth;

pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub email: String,
}

impl FromRequest for AuthenticatedUser {
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self, Self::Error>>>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        Box::pin(async move {
            let token = auth_header
                .and_then(|h| h.strip_prefix("Bearer ").map(|t| t.to_string()))
                .ok_or_else(|| {
                    actix_web::error::ErrorUnauthorized("Missing or invalid Authorization header")
                })?;

            let jwt_secret = std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-me".into());

            let claims = auth::decode_jwt(&token, &jwt_secret)
                .map_err(|_| actix_web::error::ErrorUnauthorized("Invalid or expired token"))?;

            let user_id = claims.sub.parse::<Uuid>()
                .map_err(|_| actix_web::error::ErrorUnauthorized("Invalid user ID in token"))?;

            Ok(AuthenticatedUser {
                user_id,
                email: claims.email,
            })
        })
    }
}
```

#### Task E.4 — Gateway: Scope Workspaces to Authenticated User

**Target files:** `gateway/src/routes/workspaces.rs`, `gateway/src/routes/tiles.rs`

Add `user: crate::middleware::AuthenticatedUser` as an extractor parameter to workspace handlers. Then filter/scope queries:

- `list_workspaces`: `WHERE user_id = $1` using `user.user_id`
- `create_workspace`: `INSERT ... (id, name, description, user_id, ...)` 
- `get_workspace`: `WHERE id = $1 AND user_id = $2`
- `update_workspace`: `WHERE id = $1 AND user_id = $2`
- `delete_workspace`: `WHERE id = $1 AND user_id = $2`

**Backward compatibility:** The migration makes `user_id` nullable. Existing workspaces without a `user_id` become "orphaned" — they're inaccessible via the authenticated endpoints. This is acceptable since no production data exists yet. If needed, a data migration script can assign them to a default user.

**Leave proxy routes, SSE stream, and `/health` as public** (no `AuthenticatedUser` extractor).

#### Task E.5 — Dashboard: Auth UI, Token Management, & App Gating

**Target files:** `dashboard/src/components/AuthScreen.tsx` (new), `dashboard/src/lib/api.ts`, `dashboard/src/store/index.ts`, `dashboard/src/App.tsx`

1. **Extend `api.ts`** — add auth functions and automatic `Authorization` header:

```typescript name=dashboard/src/lib/api.ts
// Add to the top:
function getToken(): string | null {
  return localStorage.getItem('wiredin_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Update apiGet/apiPost/apiPut/apiDelete to include auth headers:
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: { ...authHeaders() },
  });
  // ...
}

// Auth API functions:
export async function registerUser(email: string, password: string, name?: string) {
  const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Registration failed');
  }
  const json = await res.json();
  const data = fromApi<{ token: string; user: { id: string; email: string; name?: string } }>(json.data);
  localStorage.setItem('wiredin_token', data.token);
  return data;
}

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Login failed');
  }
  const json = await res.json();
  const data = fromApi<{ token: string; user: { id: string; email: string; name?: string } }>(json.data);
  localStorage.setItem('wiredin_token', data.token);
  return data;
}

export function logout() {
  localStorage.removeItem('wiredin_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
```

2. **Extend store** with auth state:

```typescript name=dashboard/src/store/index.ts
// Add to WiredInState interface:
user: { id: string; email: string; name?: string } | null;
login: (email: string, password: string) => Promise<void>;
register: (email: string, password: string, name?: string) => Promise<void>;
logout: () => void;

// Add to store implementation:
user: api.isAuthenticated() ? null : null,  // hydrated on login/register

login: async (email, password) => {
  const { user } = await api.loginUser(email, password);
  set({ user });
  await get().loadWorkspaces();
},

register: async (email, password, name) => {
  const { user } = await api.registerUser(email, password, name);
  set({ user });
  await get().loadWorkspaces();
},

logout: () => {
  api.logout();
  set({ user: null, workspaces: [], activeWorkspaceId: null });
},
```

3. **Create `AuthScreen.tsx`** — login/register form matching the cyberpunk theme:

A full login/register screen with email + password fields, toggle between login/register modes, error display, and styling consistent with the existing CSS custom properties.

4. **Update `App.tsx`** — gate the dashboard behind auth:

```typescript name=dashboard/src/App.tsx
import AuthScreen from './components/AuthScreen';

function App() {
  const user = useWiredInStore((s) => s.user);
  // ... existing hooks ...

  if (!user && !api.isAuthenticated()) {
    return <AuthScreen />;
  }

  // ... existing dashboard render ...
}
```

---

## Implementation Order & Dependencies

```
Wave 1 (independent, can be parallelized):
  ├── Task A.1 — Wire proxy caching into proxy.rs              [Small, gateway]
  ├── Task B.1 — API client CRUD functions + case mapping       [Medium, dashboard]
  └── Task C.1 — Tile auto-refresh timer                        [Small, dashboard]

Wave 2 (depends on B.1):
  ├── Task B.2 — Store: connect actions to API                  [Medium, dashboard]
  ├── Task B.3 — App init: loadWorkspaces on mount              [Small, dashboard]
  └── Task B.4 — Add workspaceId to Tile type                   [Small, dashboard]

Wave 3 (independent of Wave 2):
  ├── Task D.1 — Aggregator: publish to Redis on new content    [Small, aggregator]
  ├── Task D.2 — Gateway: Redis pub/sub SSE stream              [Medium, gateway]
  └── Task D.3 — Dashboard: SSE manager hook                    [Small, dashboard]

Wave 4 (depends on Wave 2):
  ├── Task E.1 — Users table, password hashing, auth.rs         [Medium, gateway]
  ├── Task E.2 — Auth endpoints (register + login)              [Medium, gateway]
  ├── Task E.3 — Auth middleware extractor                       [Small, gateway]
  ├── Task E.4 — Scope workspaces to user                       [Small, gateway]
  └── Task E.5 — Dashboard auth UI + token management           [Medium, dashboard]
```

**Recommended single-developer path:**
`A.1 → C.1 → B.1 → B.4 → B.2 → B.3 → D.1 → D.2 → D.3 → E.1 → E.2 → E.3 → E.4 → E.5`

Start with the quick wins (proxy caching, auto-refresh), then build the most impactful feature (workspace persistence), then real-time, then auth.

---

## Files Modified/Created Summary

| Track | New Files | Modified Files |
|-------|-----------|----------------|
| **A. Proxy Caching** | — | `gateway/src/routes/proxy.rs` |
| **B. Dashboard Persistence** | — | `dashboard/src/lib/api.ts`, `dashboard/src/store/index.ts`, `dashboard/src/App.tsx`, `dashboard/src/types/index.ts` |
| **C. Auto-Refresh** | — | `dashboard/src/components/TileCard.tsx` |
| **D. Real-Time SSE** | `dashboard/src/hooks/useSSE.ts` | `aggregator/src/cache/cache.service.ts`, `aggregator/src/feeds/feeds.service.ts`, `gateway/src/routes/stream.rs`, `gateway/src/cache.rs`, `gateway/Cargo.toml`, `dashboard/src/App.tsx` |
| **E. JWT Auth** | `gateway/migrations/002_create_users.sql`, `gateway/src/auth.rs`, `gateway/src/routes/auth.rs`, `gateway/src/middleware.rs`, `dashboard/src/components/AuthScreen.tsx` | `gateway/Cargo.toml`, `gateway/src/main.rs`, `gateway/src/models.rs`, `gateway/src/routes/mod.rs`, `gateway/src/routes/workspaces.rs`, `gateway/src/routes/tiles.rs`, `dashboard/src/lib/api.ts`, `dashboard/src/store/index.ts`, `dashboard/src/App.tsx` |

**Estimated scope:** ~25 files touched/created, ~2,500-3,500 lines of new/modified code across Rust, TypeScript, and SQL.

---

## Post-Phase 2 Outlook

After Phase 2, the system will have:
- ✅ Full Postgres persistence (workspaces, tiles, users, content)
- ✅ Redis caching at both proxy and aggregator layers
- ✅ Live data fetching with auto-refresh timers
- ✅ Real-time push updates via SSE/Redis pub/sub
- ✅ JWT-based multi-user authentication
- ✅ Workspace ownership scoped per user

**Phase 3** candidates would then be:
- API key management for external platform APIs (Reddit, YouTube, etc.)
- Dashboard tile drag-and-drop position persistence (debounced batch updates)
- Content deduplication across platforms
- User preferences (theme, default refresh intervals)
- Production deployment configuration (HTTPS, rate limiting, CORS tightening)
